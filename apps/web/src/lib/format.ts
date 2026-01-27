/**
 * Shared formatting utilities for displaying prices, dates, and other values.
 */

/**
 * Format a price value as USD currency.
 * Handles both number and string inputs.
 */
export function formatPrice(price: number | string | null): string {
  if (price === null || price === undefined) return "—";
  const num = typeof price === "string" ? Number.parseFloat(price) : price;
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

/**
 * Format a date string as short date (e.g., "Jan 15").
 * Handles both date-only (YYYY-MM-DD) and full ISO timestamps.
 * Parses as local date to avoid timezone hydration mismatches.
 */
export function formatShortDate(dateString: string): string {
  // Handle full ISO timestamps by extracting just the date part
  const datePart = dateString.split("T")[0];
  const [year, month, day] = datePart.split("-").map(Number);
  if (!year || !month || !day) {
    return "—";
  }
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/**
 * Format a date string as long date (e.g., "Mon, Jan 15, 2025").
 * Parses as local date to avoid timezone hydration mismatches.
 */
export function formatLongDate(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Format an ISO datetime string as date with time (e.g., "Jan 15, 10:30 AM").
 */
export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Format an ISO datetime string as relative time (e.g., "5m ago", "2h ago").
 */
export function formatTimestamp(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

/**
 * Format a duration in minutes as hours and minutes (e.g., "5h 30m").
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Format an ISO datetime string as time of day (e.g., "10:30 AM").
 * Parses the time directly from the string to avoid timezone conversion.
 * Amadeus returns times in local airport time, so we display as-is.
 */
export function formatFlightTime(dateString: string): string {
  // Extract time part from ISO string (e.g., "2024-02-13T22:48:00" -> "22:48")
  const timePart = dateString.includes("T")
    ? dateString.split("T")[1].substring(0, 5)
    : dateString;

  const [hoursStr, minutesStr] = timePart.split(":");
  const hours = Number.parseInt(hoursStr, 10);
  const minutes = minutesStr || "00";

  if (Number.isNaN(hours)) {
    return dateString; // Return as-is if we can't parse
  }

  // Convert 24h to 12h format
  const period = hours >= 12 ? "PM" : "AM";
  const hours12 = hours % 12 || 12;

  return `${hours12}:${minutes} ${period}`;
}

/**
 * Format cabin class code to display name.
 */
export function formatCabin(cabin: string): string {
  const cabinMap: Record<string, string> = {
    economy: "Economy",
    premium_economy: "Premium Economy",
    business: "Business",
    first: "First Class",
  };
  return cabinMap[cabin.toLowerCase()] || cabin;
}

/**
 * Format stops mode and max stops to display string.
 */
export function formatStopsMode(mode: string, maxStops: number | null): string {
  switch (mode.toLowerCase()) {
    case "direct":
    case "nonstop":
      return "Nonstop only";
    case "any":
      return maxStops !== null
        ? `Up to ${maxStops} stop${maxStops !== 1 ? "s" : ""}`
        : "Any";
    default:
      return mode;
  }
}

/**
 * Format number of stops to display string.
 */
export function formatStops(stops: number, stopCities?: string[]): string {
  if (stops === 0) return "Nonstop";
  if (stopCities && stopCities.length > 0) {
    return `${stops} stop (${stopCities.join(", ")})`;
  }
  return `${stops} stop${stops > 1 ? "s" : ""}`;
}

/**
 * Format room selection mode to display name.
 */
export function formatRoomSelection(mode: string): string {
  const modeMap: Record<string, string> = {
    cheapest: "Cheapest available",
    preferred: "Match preferences",
  };
  return modeMap[mode.toLowerCase()] || mode;
}

/**
 * Format notification threshold type to display name.
 */
export function formatThresholdType(type: string): string {
  const typeMap: Record<string, string> = {
    trip_total: "Total trip cost",
    total: "Total trip cost",
    flight_total: "Flight cost",
    hotel_total: "Hotel cost",
  };
  return typeMap[type.toLowerCase()] || type;
}

/**
 * Render star rating as Unicode stars.
 */
export function renderStars(rating: number): string {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

/**
 * Format a date as US compact "M/D" format (e.g., "2/15" for Feb 15).
 */
export function formatCompactDate(dateString: string): string {
  if (!dateString) return "—";
  const datePart = dateString.split("T")[0];
  const [_year, month, day] = datePart.split("-").map(Number);
  if (!month || !day) return "—";
  return `${month}/${day}`;
}

/**
 * Format a date range as US compact format (e.g., "2/15 → 2/22").
 */
export function formatDateRange(departDate: string, returnDate: string | null): string {
  const depart = formatCompactDate(departDate);
  if (!returnDate) return depart;
  const ret = formatCompactDate(returnDate);
  return `${depart} → ${ret}`;
}

/**
 * Map airline IATA codes to display names.
 * Falls back to the carrier code if not found.
 */
const AIRLINE_NAMES: Record<string, string> = {
  UA: "United",
  AA: "American",
  DL: "Delta",
  WN: "Southwest",
  B6: "JetBlue",
  AS: "Alaska",
  NK: "Spirit",
  F9: "Frontier",
  HA: "Hawaiian",
  SY: "Sun Country",
  BA: "British Airways",
  LH: "Lufthansa",
  AF: "Air France",
  KL: "KLM",
  EK: "Emirates",
  QR: "Qatar Airways",
  SQ: "Singapore",
  CX: "Cathay Pacific",
  NH: "ANA",
  JL: "JAL",
  KE: "Korean Air",
  AC: "Air Canada",
  WS: "WestJet",
  QF: "Qantas",
  VS: "Virgin Atlantic",
  VA: "Virgin Australia",
  FI: "Icelandair",
  DY: "Norwegian",
  FR: "Ryanair",
  U2: "easyJet",
  VY: "Vueling",
  IB: "Iberia",
  TP: "TAP Portugal",
  LX: "Swiss",
  OS: "Austrian",
  SN: "Brussels",
  EI: "Aer Lingus",
  AY: "Finnair",
  SK: "SAS",
  TK: "Turkish",
  EY: "Etihad",
  RJ: "Royal Jordanian",
  LY: "El Al",
  MS: "EgyptAir",
  SA: "South African",
  CM: "Copa",
  AV: "Avianca",
  LA: "LATAM",
  AM: "Aeromexico",
};

export function getAirlineName(carrierCode: string | null | undefined): string {
  if (!carrierCode) return "—";
  const code = carrierCode.toUpperCase();
  return AIRLINE_NAMES[code] || code;
}

/**
 * Format multiple airline codes to a display string.
 * E.g., ["UA", "AA"] -> "United | American"
 */
export function formatAirlines(carrierCodes: (string | null | undefined)[]): string {
  const names = carrierCodes
    .filter((code): code is string => !!code)
    .map(getAirlineName);
  return names.length > 0 ? names.join(" | ") : "—";
}
