import type { ApiFlightOffer, ApiFlightSegment } from "@/lib/api";
import { getAirlineName, formatDuration } from "@/lib/format";

const CHIP_GRADIENTS: Record<string, string> = {
  AS: "linear-gradient(135deg,#10617F,#093247)",
  UA: "linear-gradient(135deg,#2456C9,#13357F)",
  DL: "linear-gradient(135deg,#C8102E,#7A0A1C)",
};
const FALLBACK_GRADIENT = "linear-gradient(135deg,#A78BFA,#7C3AED)";

const AIRPORT_CITIES: Record<string, string> = {
  DEN: "Denver", SFO: "San Francisco", RDM: "Redmond", LAX: "Los Angeles",
  JFK: "New York", SEA: "Seattle", ORD: "Chicago", DFW: "Dallas",
  ATL: "Atlanta", PHX: "Phoenix", SLC: "Salt Lake City",
};

export function airlineChip(
  carrierCode: string | null | undefined,
): { initials: string; gradient: string } {
  const code = (carrierCode ?? "").toUpperCase();
  if (CHIP_GRADIENTS[code]) {
    return { initials: code, gradient: CHIP_GRADIENTS[code] };
  }
  const initials = code ? code.slice(0, 2).padEnd(2, code[0] ?? "-") : "--";
  return { initials, gradient: FALLBACK_GRADIENT };
}

function allSegments(flight: ApiFlightOffer): ApiFlightSegment[] {
  return (flight.itineraries ?? []).flatMap((it) => it.segments ?? []);
}

export function operatingCarriers(flight: ApiFlightOffer): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const s of allSegments(flight)) {
    const name = getAirlineName(s.carrier_code);
    if (name && name !== "—" && !seen.has(name)) {
      seen.add(name);
      names.push(name);
    }
  }
  return names;
}

export function multiCarrierSubtitle(flight: ApiFlightOffer): string | null {
  const names = operatingCarriers(flight);
  if (names.length <= 1) return null;
  return `Operated by ${names.join(" & ")}`;
}

export function stopsBadge(
  flight: ApiFlightOffer,
): { label: string; tone: "success" | "warning" } {
  const stops = flight.stops ?? 0;
  if (stops === 0) return { label: "NON-STOP", tone: "success" };
  const outbound = flight.itineraries?.[0]?.segments ?? [];
  const via = outbound.length > 1 ? outbound[0]?.arrival_airport ?? null : null;
  const base = `${stops} STOP${stops > 1 ? "S" : ""}`;
  return { label: via ? `${base} · ${via}` : base, tone: "warning" };
}

export function layoverLabel(
  prevSeg: ApiFlightSegment,
  seg: ApiFlightSegment,
): string | null {
  const arr = prevSeg.arrival_time;
  const dep = seg.departure_time;
  if (!arr || !dep) return null;
  const diffMs = new Date(dep).getTime() - new Date(arr).getTime();
  if (!Number.isFinite(diffMs) || diffMs <= 0) return null;
  const dur = formatDuration(Math.round(diffMs / 60000));
  const code = prevSeg.arrival_airport ?? "—";
  const city = AIRPORT_CITIES[code.toUpperCase()];
  return city ? `${dur} layover in ${city} (${code})` : `${dur} layover in ${code}`;
}
