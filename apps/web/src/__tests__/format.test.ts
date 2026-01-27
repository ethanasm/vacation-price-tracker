import {
  formatPrice,
  formatShortDate,
  formatLongDate,
  formatDateTime,
  formatTimestamp,
  formatDuration,
  formatFlightTime,
  formatCabin,
  formatStopsMode,
  formatStops,
  formatRoomSelection,
  formatThresholdType,
  renderStars,
  formatCompactDate,
  formatDateRange,
  getAirlineName,
} from "../lib/format";

describe("format utilities", () => {
  describe("formatPrice", () => {
    it("formats a number price to USD currency", () => {
      expect(formatPrice(1234.56)).toBe("$1,235");
    });

    it("formats a string price to USD currency", () => {
      expect(formatPrice("1234.56")).toBe("$1,235");
    });

    it("returns dash for null price", () => {
      expect(formatPrice(null)).toBe("—");
    });

    it("returns dash for undefined price", () => {
      expect(formatPrice(undefined as unknown as null)).toBe("—");
    });

    it("returns dash for NaN", () => {
      expect(formatPrice("not a number")).toBe("—");
    });

    it("formats zero correctly", () => {
      expect(formatPrice(0)).toBe("$0");
    });

    it("formats large numbers with commas", () => {
      expect(formatPrice(1000000)).toBe("$1,000,000");
    });
  });

  describe("formatShortDate", () => {
    it("formats date string to short date", () => {
      const result = formatShortDate("2025-01-15");
      expect(result).toBe("Jan 15");
    });

    it("formats various months correctly", () => {
      expect(formatShortDate("2025-06-22")).toBe("Jun 22");
      expect(formatShortDate("2025-12-01")).toBe("Dec 1");
    });
  });

  describe("formatLongDate", () => {
    it("formats date string to long date with weekday", () => {
      const result = formatLongDate("2025-01-15");
      // Day of week may vary by locale, but should contain month and year
      expect(result).toMatch(/Jan 15, 2025/);
    });

    it("formats various dates correctly", () => {
      const result = formatLongDate("2025-06-22");
      expect(result).toMatch(/Jun 22, 2025/);
    });
  });

  describe("formatDateTime", () => {
    it("formats ISO datetime to readable format", () => {
      const result = formatDateTime("2025-01-15T10:30:00Z");
      // Locale-dependent, but should include month and time
      expect(result).toMatch(/Jan/);
      expect(result).toMatch(/\d{1,2}:\d{2}/);
    });
  });

  describe("formatTimestamp", () => {
    it("returns 'Just now' for very recent timestamps", () => {
      const now = new Date().toISOString();
      expect(formatTimestamp(now)).toBe("Just now");
    });

    it("returns minutes ago for recent timestamps", () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      expect(formatTimestamp(fiveMinutesAgo)).toBe("5m ago");
    });

    it("returns hours ago for timestamps within a day", () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      expect(formatTimestamp(twoHoursAgo)).toBe("2h ago");
    });

    it("returns days ago for older timestamps", () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      expect(formatTimestamp(twoDaysAgo)).toBe("2d ago");
    });
  });

  describe("formatDuration", () => {
    it("formats minutes to hours and minutes", () => {
      expect(formatDuration(90)).toBe("1h 30m");
    });

    it("formats exact hours without minutes", () => {
      expect(formatDuration(120)).toBe("2h");
    });

    it("formats minutes only", () => {
      expect(formatDuration(45)).toBe("0h 45m");
    });

    it("formats zero minutes", () => {
      expect(formatDuration(0)).toBe("0h");
    });

    it("formats large durations", () => {
      expect(formatDuration(330)).toBe("5h 30m");
    });
  });

  describe("formatFlightTime", () => {
    it("formats morning time correctly", () => {
      expect(formatFlightTime("2025-06-15T08:30:00")).toBe("8:30 AM");
    });

    it("formats afternoon time correctly", () => {
      expect(formatFlightTime("2025-06-15T14:45:00")).toBe("2:45 PM");
    });

    it("formats evening time correctly", () => {
      expect(formatFlightTime("2025-06-15T22:48:00")).toBe("10:48 PM");
    });

    it("formats midnight correctly", () => {
      expect(formatFlightTime("2025-06-15T00:15:00")).toBe("12:15 AM");
    });

    it("formats noon correctly", () => {
      expect(formatFlightTime("2025-06-15T12:00:00")).toBe("12:00 PM");
    });

    it("handles time without seconds", () => {
      expect(formatFlightTime("2025-06-15T09:30")).toBe("9:30 AM");
    });

    it("handles simple time string", () => {
      expect(formatFlightTime("16:45")).toBe("4:45 PM");
    });

    it("returns original for unparseable input", () => {
      expect(formatFlightTime("invalid")).toBe("invalid");
    });
  });

  describe("formatCabin", () => {
    it("formats economy cabin", () => {
      expect(formatCabin("economy")).toBe("Economy");
    });

    it("formats premium_economy cabin", () => {
      expect(formatCabin("premium_economy")).toBe("Premium Economy");
    });

    it("formats business cabin", () => {
      expect(formatCabin("business")).toBe("Business");
    });

    it("formats first cabin", () => {
      expect(formatCabin("first")).toBe("First Class");
    });

    it("returns original value for unknown cabin", () => {
      expect(formatCabin("unknown")).toBe("unknown");
    });

    it("handles uppercase input", () => {
      expect(formatCabin("ECONOMY")).toBe("Economy");
    });
  });

  describe("formatStopsMode", () => {
    it("formats direct mode", () => {
      expect(formatStopsMode("direct", null)).toBe("Nonstop only");
    });

    it("formats nonstop mode", () => {
      expect(formatStopsMode("nonstop", null)).toBe("Nonstop only");
    });

    it("formats any mode without max stops", () => {
      expect(formatStopsMode("any", null)).toBe("Any");
    });

    it("formats any mode with max stops singular", () => {
      expect(formatStopsMode("any", 1)).toBe("Up to 1 stop");
    });

    it("formats any mode with max stops plural", () => {
      expect(formatStopsMode("any", 2)).toBe("Up to 2 stops");
    });

    it("returns original value for unknown mode", () => {
      expect(formatStopsMode("custom", null)).toBe("custom");
    });
  });

  describe("formatStops", () => {
    it("formats zero stops as Nonstop", () => {
      expect(formatStops(0)).toBe("Nonstop");
    });

    it("formats single stop", () => {
      expect(formatStops(1)).toBe("1 stop");
    });

    it("formats multiple stops", () => {
      expect(formatStops(2)).toBe("2 stops");
    });

    it("formats stops with cities", () => {
      expect(formatStops(1, ["Denver"])).toBe("1 stop (Denver)");
    });

    it("formats stops with multiple cities", () => {
      expect(formatStops(2, ["Denver", "Chicago"])).toBe("2 stop (Denver, Chicago)");
    });

    it("ignores empty cities array", () => {
      expect(formatStops(1, [])).toBe("1 stop");
    });
  });

  describe("formatRoomSelection", () => {
    it("formats cheapest mode", () => {
      expect(formatRoomSelection("cheapest")).toBe("Cheapest available");
    });

    it("formats preferred mode", () => {
      expect(formatRoomSelection("preferred")).toBe("Match preferences");
    });

    it("returns original value for unknown mode", () => {
      expect(formatRoomSelection("custom")).toBe("custom");
    });

    it("handles uppercase input", () => {
      expect(formatRoomSelection("CHEAPEST")).toBe("Cheapest available");
    });
  });

  describe("formatThresholdType", () => {
    it("formats trip_total type", () => {
      expect(formatThresholdType("trip_total")).toBe("Total trip cost");
    });

    it("formats total type", () => {
      expect(formatThresholdType("total")).toBe("Total trip cost");
    });

    it("formats flight_total type", () => {
      expect(formatThresholdType("flight_total")).toBe("Flight cost");
    });

    it("formats hotel_total type", () => {
      expect(formatThresholdType("hotel_total")).toBe("Hotel cost");
    });

    it("returns original value for unknown type", () => {
      expect(formatThresholdType("custom")).toBe("custom");
    });

    it("handles uppercase input", () => {
      expect(formatThresholdType("TRIP_TOTAL")).toBe("Total trip cost");
    });
  });

  describe("renderStars", () => {
    it("renders 1 star rating", () => {
      expect(renderStars(1)).toBe("★☆☆☆☆");
    });

    it("renders 3 star rating", () => {
      expect(renderStars(3)).toBe("★★★☆☆");
    });

    it("renders 5 star rating", () => {
      expect(renderStars(5)).toBe("★★★★★");
    });

    it("renders 0 star rating", () => {
      expect(renderStars(0)).toBe("☆☆☆☆☆");
    });
  });

  describe("formatCompactDate", () => {
    it("formats date as M/D", () => {
      expect(formatCompactDate("2025-02-15")).toBe("2/15");
    });

    it("formats date with T timestamp", () => {
      expect(formatCompactDate("2025-12-01T10:30:00")).toBe("12/1");
    });

    it("returns dash for empty string", () => {
      expect(formatCompactDate("")).toBe("—");
    });

    it("returns dash for invalid date", () => {
      expect(formatCompactDate("invalid")).toBe("—");
    });
  });

  describe("formatDateRange", () => {
    it("formats date range with return date", () => {
      expect(formatDateRange("2025-02-15", "2025-02-22")).toBe("2/15 → 2/22");
    });

    it("formats single date when no return", () => {
      expect(formatDateRange("2025-02-15", null)).toBe("2/15");
    });

    it("handles dates with timestamps", () => {
      expect(formatDateRange("2025-06-01T00:00:00", "2025-06-10T00:00:00")).toBe("6/1 → 6/10");
    });
  });

  describe("getAirlineName", () => {
    it("returns airline name for known code", () => {
      expect(getAirlineName("UA")).toBe("United");
      expect(getAirlineName("AA")).toBe("American");
      expect(getAirlineName("DL")).toBe("Delta");
    });

    it("handles lowercase codes", () => {
      expect(getAirlineName("ua")).toBe("United");
    });

    it("returns code for unknown airline", () => {
      expect(getAirlineName("XY")).toBe("XY");
    });

    it("returns dash for null", () => {
      expect(getAirlineName(null)).toBe("—");
    });

    it("returns dash for undefined", () => {
      expect(getAirlineName(undefined)).toBe("—");
    });
  });
});
