"""Extended parser for Google Flights pages fetched via the fast-flights library.

The upstream ``fast_flights.parser`` reads only the "best flights" section
(``payload[3][0]``) and skips per-segment airline identity. This parser — a
sibling of ``skiplagged_parser.py`` in spirit — reads the same embedded JS
payload but extracts everything the tracker needs (verified empirically
against live pages, 2026-07):

- **both** itinerary sections: "best" (``payload[3][0]``) and the additional
  departing options (``payload[2][0]``) that the library drops — the cheapest
  fare regularly hides in the second section;
- per-segment **carrier code and flight number** (``segment[22]`` =
  ``[carrier, number, ..., airline name]``), which the library ignores
  entirely;
- the page's airline code->name metadata (``payload[7][1][1]``).

Payload indexes are Google's obfuscated structure and can drift; every read is
guarded so a shape change degrades to missing fields, not a crash.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from fast_flights import FlightsNotFound
from selectolax.lexbor import LexborHTMLParser


@dataclass
class ParsedSegment:
    """One flight segment with full identity and local timestamps."""

    from_code: str | None = None
    from_name: str | None = None
    to_code: str | None = None
    to_name: str | None = None
    departure: datetime | None = None
    arrival: datetime | None = None
    duration_minutes: int | None = None
    plane_type: str | None = None
    carrier: str | None = None
    flight_number: str | None = None
    airline_name: str | None = None

    @property
    def designator(self) -> str | None:
        """Full carrier-prefixed flight designator, e.g. ``"AS943"``."""
        if self.carrier and self.flight_number:
            return f"{self.carrier}{self.flight_number}"
        return None


@dataclass
class ParsedItinerary:
    """One itinerary (price + segments) from either page section."""

    price: int | None = None
    airline_names: list[str] = field(default_factory=list)
    segments: list[ParsedSegment] = field(default_factory=list)
    is_best: bool = False


@dataclass
class ParsedPage:
    itineraries: list[ParsedItinerary] = field(default_factory=list)
    airline_code_to_name: dict[str, str] = field(default_factory=dict)


def _extract_payload(html: str) -> Any:
    parser = LexborHTMLParser(html)
    script = parser.css_first(r"script.ds\:1")
    if script is None:
        raise ValueError("Google Flights payload script not found (blocked or changed page)")
    data = script.text().split("data:", 1)[1].rsplit(",", 1)[0]
    if data.endswith("errorHasStatus: true"):
        raise FlightsNotFound("no flights found; received error")
    return json.loads(data)


def _at(node: Any, *indexes: int) -> Any:
    """Nested list access returning None on any shape mismatch."""
    for i in indexes:
        if not isinstance(node, list) or i >= len(node):
            return None
        node = node[i]
    return node


def _to_datetime(date_part: Any, time_part: Any) -> datetime | None:
    """Combine ``[y, m, d]`` + ``[h]``/``[h, m]`` payload arrays (local time).

    Google omits trailing zero components: a 2:00 PM departure arrives as
    ``[14]``, midnight as ``None``/``[]``.
    """
    if not isinstance(date_part, list) or len(date_part) != 3:
        return None
    time_part = time_part if isinstance(time_part, list) else []
    hour = time_part[0] if len(time_part) >= 1 and isinstance(time_part[0], int) else 0
    minute = time_part[1] if len(time_part) >= 2 and isinstance(time_part[1], int) else 0
    try:
        return datetime(date_part[0], date_part[1], date_part[2], hour, minute)
    except (TypeError, ValueError):
        return None


def _parse_segment(seg: Any) -> ParsedSegment | None:
    if not isinstance(seg, list) or len(seg) < 22:
        return None
    identity = _at(seg, 22) or []
    carrier = _at(identity, 0)
    number = _at(identity, 1)
    duration = _at(seg, 11)
    return ParsedSegment(
        from_code=_at(seg, 3) if isinstance(_at(seg, 3), str) else None,
        from_name=_at(seg, 4) if isinstance(_at(seg, 4), str) else None,
        to_code=_at(seg, 6) if isinstance(_at(seg, 6), str) else None,
        to_name=_at(seg, 5) if isinstance(_at(seg, 5), str) else None,
        departure=_to_datetime(_at(seg, 20), _at(seg, 8)),
        arrival=_to_datetime(_at(seg, 21), _at(seg, 10)),
        duration_minutes=duration if isinstance(duration, int) else None,
        plane_type=_at(seg, 17) if isinstance(_at(seg, 17), str) else None,
        carrier=str(carrier) if isinstance(carrier, str) and carrier else None,
        flight_number=str(number) if isinstance(number, (str, int)) and number else None,
        airline_name=_at(identity, 3) if isinstance(_at(identity, 3), str) else None,
    )


def _parse_itinerary(item: Any, is_best: bool) -> ParsedItinerary | None:
    flight = _at(item, 0)
    if not isinstance(flight, list):
        return None
    price = _at(item, 1, 0, 1)
    names = _at(flight, 1)
    segments = []
    for seg in _at(flight, 2) or []:
        parsed = _parse_segment(seg)
        if parsed is not None:
            segments.append(parsed)
    if not segments:
        return None
    return ParsedItinerary(
        price=price if isinstance(price, int) else None,
        airline_names=[str(n) for n in names if isinstance(n, str)] if isinstance(names, list) else [],
        segments=segments,
        is_best=is_best,
    )


def parse_flights_page(html: str) -> ParsedPage:
    """Parse a Google Flights results page into itineraries + airline metadata.

    Returns best-section itineraries first (Google's own ranking), then the
    additional departing options. Raises ``FlightsNotFound`` on Google's
    explicit no-flights answer and ``ValueError`` when the payload script is
    absent (blocked/unparseable page — callers treat that as transient).
    """
    payload = _extract_payload(html)

    code_to_name: dict[str, str] = {}
    for entry in _at(payload, 7, 1, 1) or []:
        code, name = _at(entry, 0), _at(entry, 1)
        if isinstance(code, str) and isinstance(name, str) and code:
            code_to_name[code.upper()] = name

    itineraries: list[ParsedItinerary] = []
    for section_index, is_best in ((3, True), (2, False)):
        for item in _at(payload, section_index, 0) or []:
            parsed = _parse_itinerary(item, is_best)
            if parsed is not None:
                itineraries.append(parsed)

    return ParsedPage(itineraries=itineraries, airline_code_to_name=code_to_name)
