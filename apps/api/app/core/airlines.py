"""Static IATA carrier-code -> display-name lookup.

The Kiwi MCP returns per-segment carrier codes but no airline display names
(Skiplagged returned names directly). This small table covers the carriers a
US/EU-focused vacation tracker realistically encounters; unknown codes fall
back to the code itself so the UI never renders an empty airline label.
"""

from __future__ import annotations

AIRLINE_NAMES: dict[str, str] = {
    "AA": "American Airlines",
    "AC": "Air Canada",
    "AF": "Air France",
    "AM": "Aeroméxico",
    "AS": "Alaska Airlines",
    "AV": "Avianca",
    "AY": "Finnair",
    "AZ": "ITA Airways",
    "B6": "JetBlue",
    "BA": "British Airways",
    "CM": "Copa Airlines",
    "CX": "Cathay Pacific",
    "DL": "Delta",
    "DY": "Norwegian",
    "EI": "Aer Lingus",
    "EK": "Emirates",
    "EY": "Etihad Airways",
    "F9": "Frontier",
    "FI": "Icelandair",
    "FR": "Ryanair",
    "G4": "Allegiant Air",
    "HA": "Hawaiian Airlines",
    "IB": "Iberia",
    "JL": "Japan Airlines",
    "KE": "Korean Air",
    "KL": "KLM",
    "LA": "LATAM",
    "LH": "Lufthansa",
    "LX": "SWISS",
    "MX": "Breeze Airways",
    "NH": "ANA",
    "NK": "Spirit",
    "NZ": "Air New Zealand",
    "OS": "Austrian Airlines",
    "QF": "Qantas",
    "QR": "Qatar Airways",
    "SK": "SAS",
    "SN": "Brussels Airlines",
    "SQ": "Singapore Airlines",
    "SY": "Sun Country",
    "TK": "Turkish Airlines",
    "TP": "TAP Air Portugal",
    "TS": "Air Transat",
    "U2": "easyJet",
    "UA": "United",
    "VS": "Virgin Atlantic",
    "VY": "Vueling",
    "W6": "Wizz Air",
    "WN": "Southwest",
    "WS": "WestJet",
    "Y4": "Volaris",
}


def airline_display_name(carrier_code: str | None) -> str | None:
    """Return a display name for an IATA carrier code (the code itself if unknown)."""
    if not carrier_code:
        return None
    code = carrier_code.strip().upper()
    if not code:
        return None
    return AIRLINE_NAMES.get(code, code)
