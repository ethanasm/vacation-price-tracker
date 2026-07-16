"""Fixture builders for fast-flights tests.

Fabricates Google Flights result pages with the same embedded-JS payload
shape the live site serves (verified 2026-07): itinerary sections at
``payload[3][0]`` (best) and ``payload[2][0]`` (other), airline metadata at
``payload[7][1][1]``, and per-segment identity at ``segment[22]``.
"""

from __future__ import annotations

import json
from typing import Any


def seg_array(
    frm: str = "SFO",
    to: str = "LAX",
    dep: tuple = ((2026, 9, 15), (8, 30)),
    arr: tuple = ((2026, 9, 15), (10, 5)),
    duration: int | None = 95,
    carrier: str | None = "AS",
    number: str | None = "943",
    airline: str = "Alaska Airlines",
    plane: str = "Boeing 737",
) -> list:
    seg: list[Any] = [None] * 33
    seg[3] = frm
    seg[4] = f"{frm} International Airport"
    seg[5] = f"{to} International Airport"
    seg[6] = to
    seg[8] = list(dep[1])
    seg[10] = list(arr[1])
    seg[11] = duration
    seg[17] = plane
    seg[20] = list(dep[0])
    seg[21] = list(arr[0])
    seg[22] = [carrier, number, None, airline]
    return seg


def itin_array(price: int | None, segs: list[list], names: list[str] | None = None) -> list:
    flight: list[Any] = [None, names if names is not None else [], segs]
    return [flight, [[None, price]]]


def page_html(
    best: list | None = None,
    other: list | None = None,
    airlines: list[tuple[str, str]] | None = None,
) -> str:
    best = best or []
    other = other or []
    if airlines is None:
        airlines = [("AS", "Alaska Airlines"), ("UA", "United"), ("AA", "American")]
    payload: list[Any] = [None] * 8
    payload[2] = [other or None]
    payload[3] = [best or None, len(best) + len(other)]
    payload[7] = [None, [[], [list(a) for a in airlines]]]
    data = json.dumps(payload)
    return (
        "<html><body><script class=\"ds:1\">"
        f"AF_initDataCallback({{key: 'ds:1', hash: '1', data:{data}, sideChannel: {{}}}});"
        "</script></body></html>"
    )


def error_page_html() -> str:
    return (
        "<html><body><script class=\"ds:1\">"
        "AF_initDataCallback({key: 'ds:1', data: [], errorHasStatus: true, sideChannel: {}});"
        "</script></body></html>"
    )
