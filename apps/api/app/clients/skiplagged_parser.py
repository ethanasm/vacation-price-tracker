"""Parser for Skiplagged flight IDs to extract flight numbers.

Skiplagged encodes flight segments in the `id` field:
    "SFO-CDG-2026-06-15-2026-06-22-trip=AC744-LH6825,TS251-AC401-AC741"

Format after "trip=":
    {outbound segments joined by -},{return segments joined by -}

Each segment is: {carrier_code}{flight_number}
A trailing ~ indicates a hidden-city itinerary.
"""

from __future__ import annotations

import re

from app.schemas.skiplagged import SkiplaggedFlightSegment

# Matches carrier code (2-3 uppercase letters) followed by flight number (digits)
_SEGMENT_PATTERN = re.compile(r"^([A-Z]{2,3})(\d+)$")


def _parse_segment(raw: str) -> SkiplaggedFlightSegment | None:
    """Parse a single segment string like 'AC744' or 'AF81~'."""
    cleaned = raw.strip().rstrip("~")
    if not cleaned:
        return None
    match = _SEGMENT_PATTERN.match(cleaned)
    if not match:
        return None
    return SkiplaggedFlightSegment(
        carrier_code=match.group(1),
        flight_number=match.group(2),
    )


def _parse_leg(leg_str: str) -> list[SkiplaggedFlightSegment]:
    """Parse a leg string like 'AC744-LH6825' into segment list."""
    if not leg_str.strip():
        return []
    segments = []
    for raw in leg_str.split("-"):
        seg = _parse_segment(raw)
        if seg:
            segments.append(seg)
    return segments


def parse_flight_segments(
    flight_id: str,
) -> tuple[list[SkiplaggedFlightSegment], list[SkiplaggedFlightSegment]]:
    """Parse a Skiplagged flight ID into outbound and return segments.

    Args:
        flight_id: The Skiplagged flight `id` field.

    Returns:
        Tuple of (outbound_segments, return_segments).
        Both are empty lists if the ID cannot be parsed.
    """
    if "trip=" not in flight_id:
        return [], []

    trip_part = flight_id.split("trip=", 1)[1]

    if "," in trip_part:
        outbound_str, return_str = trip_part.split(",", 1)
        return _parse_leg(outbound_str), _parse_leg(return_str)

    return _parse_leg(trip_part), []
