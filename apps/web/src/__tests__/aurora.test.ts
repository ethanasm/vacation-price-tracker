import {
  airlineChip,
  operatingCarriers,
  multiCarrierSubtitle,
  stopsBadge,
  layoverLabel,
} from "@/lib/aurora";
import type { ApiFlightOffer, ApiFlightSegment } from "@/lib/api";

const seg = (over: Partial<ApiFlightSegment>): ApiFlightSegment => ({
  carrier_code: "UA", flight_number: "UA508",
  departure_airport: "SFO", arrival_airport: "DEN",
  departure_time: "2025-08-22T07:05:00", arrival_time: "2025-08-22T10:30:00",
  duration_minutes: 205, ...over,
});

const nonstop: ApiFlightOffer = {
  id: "as1", airline_code: "AS", price: "177", stops: 0,
  itineraries: [{ direction: "outbound", stops: 0, segments: [seg({ carrier_code: "AS", flight_number: "AS1", arrival_airport: "RDM" })] }],
};
const oneStopMulti: ApiFlightOffer = {
  id: "ua1", airline_code: "UA", price: "154", stops: 1,
  itineraries: [{ direction: "outbound", stops: 1, segments: [
    seg({ carrier_code: "UA", flight_number: "UA508", arrival_airport: "DEN", arrival_time: "2025-08-22T10:30:00" }),
    seg({ carrier_code: "AS", flight_number: "AS2201", departure_airport: "DEN", arrival_airport: "RDM", departure_time: "2025-08-22T11:40:00" }),
  ] }],
};

describe("airlineChip", () => {
  it("maps AS/UA/DL to their gradients", () => {
    expect(airlineChip("AS")).toEqual({ initials: "AS", gradient: "linear-gradient(135deg,#10617F,#093247)" });
    expect(airlineChip("UA")).toEqual({ initials: "UA", gradient: "linear-gradient(135deg,#2456C9,#13357F)" });
    expect(airlineChip("DL")).toEqual({ initials: "DL", gradient: "linear-gradient(135deg,#C8102E,#7A0A1C)" });
  });
  it("falls back to two-letter initials + violet gradient", () => {
    expect(airlineChip("b6")).toEqual({ initials: "B6", gradient: "linear-gradient(135deg,#A78BFA,#7C3AED)" });
    expect(airlineChip(null).initials).toBe("--");
  });
});

describe("operatingCarriers + multiCarrierSubtitle", () => {
  it("single carrier → no subtitle", () => {
    expect(operatingCarriers(nonstop)).toEqual(["Alaska"]);
    expect(multiCarrierSubtitle(nonstop)).toBeNull();
  });
  it("two carriers → 'Operated by United & Alaska'", () => {
    expect(operatingCarriers(oneStopMulti)).toEqual(["United", "Alaska"]);
    expect(multiCarrierSubtitle(oneStopMulti)).toBe("Operated by United & Alaska");
  });
});

describe("stopsBadge", () => {
  it("non-stop → success NON-STOP", () => {
    expect(stopsBadge(nonstop)).toEqual({ label: "NON-STOP", tone: "success" });
  });
  it("one stop → warning with via airport", () => {
    expect(stopsBadge(oneStopMulti)).toEqual({ label: "1 STOP · DEN", tone: "warning" });
  });
});

describe("layoverLabel", () => {
  it("formats the layover with city + code", () => {
    const segments = oneStopMulti.itineraries?.[0]?.segments ?? [];
    const [a, b] = segments;
    expect(layoverLabel(a, b)).toBe("1h 10m layover in Denver (DEN)");
  });
  it("returns null when times are missing", () => {
    expect(layoverLabel({ ...seg({}), arrival_time: null }, seg({}))).toBeNull();
  });
});
