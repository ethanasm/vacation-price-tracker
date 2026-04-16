"""Tests for Skiplagged flight number parser."""

from app.clients.skiplagged_parser import parse_flight_segments


class TestParseFlightSegments:
    def test_single_outbound_segment(self):
        flight_id = "SFO-CDG-2026-06-15-trip=AF81"
        outbound, return_segs = parse_flight_segments(flight_id)
        assert len(outbound) == 1
        assert outbound[0].carrier_code == "AF"
        assert outbound[0].flight_number == "81"
        assert return_segs == []

    def test_multi_segment_outbound(self):
        flight_id = "SFO-CDG-2026-06-15-trip=AC744-LH6825"
        outbound, return_segs = parse_flight_segments(flight_id)
        assert len(outbound) == 2
        assert outbound[0].carrier_code == "AC"
        assert outbound[0].flight_number == "744"
        assert outbound[1].carrier_code == "LH"
        assert outbound[1].flight_number == "6825"
        assert return_segs == []

    def test_round_trip(self):
        flight_id = "SFO-CDG-2026-06-15-2026-06-22-trip=AF81,TS251-AC401"
        outbound, return_segs = parse_flight_segments(flight_id)
        assert len(outbound) == 1
        assert outbound[0].carrier_code == "AF"
        assert outbound[0].flight_number == "81"
        assert len(return_segs) == 2
        assert return_segs[0].carrier_code == "TS"
        assert return_segs[0].flight_number == "251"
        assert return_segs[1].carrier_code == "AC"
        assert return_segs[1].flight_number == "401"

    def test_hidden_city_marker_stripped(self):
        flight_id = "SFO-CDG-2026-06-15-trip=AF81~"
        outbound, _ = parse_flight_segments(flight_id)
        assert len(outbound) == 1
        assert outbound[0].carrier_code == "AF"
        assert outbound[0].flight_number == "81"

    def test_hidden_city_round_trip(self):
        flight_id = "SFO-CDG-2026-06-15-2026-06-22-trip=AF81~,TS251-AC401-AC741"
        outbound, return_segs = parse_flight_segments(flight_id)
        assert outbound[0].carrier_code == "AF"
        assert outbound[0].flight_number == "81"
        assert len(return_segs) == 3

    def test_no_trip_marker(self):
        flight_id = "SFO-CDG-2026-06-15"
        outbound, return_segs = parse_flight_segments(flight_id)
        assert outbound == []
        assert return_segs == []

    def test_empty_string(self):
        outbound, return_segs = parse_flight_segments("")
        assert outbound == []
        assert return_segs == []

    def test_complex_real_id(self):
        flight_id = "SFO-CDG-2026-06-15-2026-06-22-trip=AC744-LH6825,TS251-AC401-AC741"
        outbound, return_segs = parse_flight_segments(flight_id)
        assert len(outbound) == 2
        assert len(return_segs) == 3
        assert outbound[0].carrier_code == "AC"
        assert return_segs[2].carrier_code == "AC"
        assert return_segs[2].flight_number == "741"
