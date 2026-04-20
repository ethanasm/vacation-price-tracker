import {
  hasErrors,
  validateAirportCode,
  validateDepartDate,
  validateName,
  validateReturnDate,
  validateThresholdValue,
  validateTripForm,
} from "../components/trip-form/validation";
import { baseTripFormData } from "@/lib/fixtures/trip-form";
import type { TripFormData } from "../components/trip-form/types";

function baseFormData(overrides: Partial<TripFormData> = {}): TripFormData {
  const depart = new Date();
  depart.setDate(depart.getDate() + 10);
  const ret = new Date();
  ret.setDate(ret.getDate() + 17);
  return {
    name: "Test",
    originAirport: "SFO",
    destinationCode: "MIA",
    isRoundTrip: true,
    departDate: depart,
    returnDate: ret,
    adults: "1",
    trackFlights: true,
    trackHotels: true,
    flightPrefs: { cabin: "economy", stopsMode: "any", airlines: [] },
    hotelPrefs: {
      rooms: "1",
      adultsPerRoom: "2",
      city: "Miami Beach",
      roomSelectionMode: "cheapest",
      roomTypes: [],
      views: [],
    },
    notificationPrefs: {
      thresholdType: "trip_total",
      thresholdValue: "",
      emailEnabled: false,
      smsEnabled: false,
    },
    flightPrefsOpen: false,
    hotelPrefsOpen: false,
    ...overrides,
  };
}

describe("validateTripForm", () => {
  it("does not require a return date for one-way trips", () => {
    const errors = validateTripForm({
      ...baseTripFormData,
      isRoundTrip: false,
      returnDate: undefined,
    });

    expect(errors.returnDate).toBeUndefined();
  });

  it("requires a return date for round trips", () => {
    const errors = validateTripForm({
      ...baseTripFormData,
      isRoundTrip: true,
      returnDate: undefined,
    });

    expect(errors.returnDate).toBeDefined();
  });

  it("accepts lowercase airport codes", () => {
    const errors = validateTripForm({
      ...baseTripFormData,
      originAirport: "sfo",
      destinationCode: "lax",
    });

    expect(errors.originAirport).toBeUndefined();
    expect(errors.destinationCode).toBeUndefined();
  });
});

describe("field validation helpers", () => {
  it("rejects empty trip names", () => {
    expect(validateName("   ")).toBe("Trip name is required");
  });

  it("rejects trip names longer than 100 characters", () => {
    const longName = "A".repeat(101);
    expect(validateName(longName)).toBe("Trip name must be 100 characters or less");
  });

  it("accepts valid trip names", () => {
    expect(validateName("Fall Getaway")).toBeUndefined();
  });

  it("validates airport codes", () => {
    expect(validateAirportCode("sf")).toBe("Enter a valid 3-letter airport code");
    expect(validateAirportCode("sfo")).toBeUndefined();
  });

  it("requires a departure date", () => {
    expect(validateDepartDate(undefined)).toBe("Departure date is required");
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 30);
    expect(validateDepartDate(futureDate)).toBeUndefined();
  });

  it("rejects departure dates in the past", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    expect(validateDepartDate(yesterday)).toBe("Departure date cannot be in the past");
  });

  it("rejects departure dates more than 359 days out", () => {
    const tooFar = new Date();
    tooFar.setDate(tooFar.getDate() + 360);
    expect(validateDepartDate(tooFar)).toBe("Departure date cannot be more than 359 days out");

    const maxAllowed = new Date();
    maxAllowed.setDate(maxAllowed.getDate() + 359);
    expect(validateDepartDate(maxAllowed)).toBeUndefined();
  });

  it("validates return dates", () => {
    const departDate = new Date();
    departDate.setDate(departDate.getDate() + 10);
    const returnDateBefore = new Date(departDate);
    returnDateBefore.setDate(returnDateBefore.getDate() - 1);
    expect(validateReturnDate(undefined, departDate)).toBe("Return date is required");
    expect(validateReturnDate(returnDateBefore, departDate)).toBe(
      "Return date must be after departure"
    );
    const validReturn = new Date(departDate);
    validReturn.setDate(validReturn.getDate() + 2);
    expect(validateReturnDate(validReturn, departDate)).toBeUndefined();
  });

  it("rejects return dates more than 359 days out", () => {
    const departDate = new Date();
    departDate.setDate(departDate.getDate() + 300);
    const tooFar = new Date();
    tooFar.setDate(tooFar.getDate() + 360);
    expect(validateReturnDate(tooFar, departDate)).toBe("Return date cannot be more than 359 days out");

    const maxAllowed = new Date();
    maxAllowed.setDate(maxAllowed.getDate() + 359);
    expect(validateReturnDate(maxAllowed, departDate)).toBeUndefined();
  });

  it("validates threshold values", () => {
    expect(validateThresholdValue("")).toBe("Enter a valid price threshold");
    expect(validateThresholdValue("0")).toBe("Enter a valid price threshold");
    expect(validateThresholdValue("2500")).toBeUndefined();
  });
});

describe("validateTripForm and hasErrors", () => {
  it("collects errors for invalid fields", () => {
    const errors = validateTripForm({
      ...baseTripFormData,
      name: " ",
      originAirport: "SF",
      destinationCode: "L",
      departDate: undefined,
      returnDate: undefined,
      notificationPrefs: {
        ...baseTripFormData.notificationPrefs,
        thresholdValue: "",
        emailEnabled: true,
      },
    });

    expect(errors.name).toBeDefined();
    expect(errors.originAirport).toBeDefined();
    expect(errors.destinationCode).toBeDefined();
    expect(errors.departDate).toBeDefined();
    expect(errors.returnDate).toBeDefined();
    expect(errors.thresholdValue).toBeDefined();
    expect(hasErrors(errors)).toBe(true);
  });

  it("skips return date validation for one-way trips", () => {
    const errors = validateTripForm({
      ...baseTripFormData,
      isRoundTrip: false,
      returnDate: undefined,
    });

    expect(errors.returnDate).toBeUndefined();
  });

  it("ignores stale return date when one-way", () => {
    // Even if a stale returnDate is still in form state, one-way mode skips its validation
    const errors = validateTripForm({
      ...baseTripFormData,
      isRoundTrip: false,
      returnDate: new Date(2025, 5, 9),
    });

    expect(errors.returnDate).toBeUndefined();
  });

  it("reports no errors for valid data", () => {
    const errors = validateTripForm(baseTripFormData);
    expect(hasErrors(errors)).toBe(false);
  });

  it("skips threshold validation when notifications are disabled", () => {
    const errors = validateTripForm({
      ...baseTripFormData,
      notificationPrefs: {
        ...baseTripFormData.notificationPrefs,
        thresholdValue: "",
        emailEnabled: false,
        smsEnabled: false,
      },
    });

    expect(errors.thresholdValue).toBeUndefined();
  });

  it("validates threshold when email notifications are enabled", () => {
    const errors = validateTripForm({
      ...baseTripFormData,
      notificationPrefs: {
        ...baseTripFormData.notificationPrefs,
        thresholdValue: "",
        emailEnabled: true,
        smsEnabled: false,
      },
    });

    expect(errors.thresholdValue).toBeDefined();
  });

  it("validates threshold when SMS notifications are enabled", () => {
    const errors = validateTripForm({
      ...baseTripFormData,
      notificationPrefs: {
        ...baseTripFormData.notificationPrefs,
        thresholdValue: "",
        emailEnabled: false,
        smsEnabled: true,
      },
    });

    expect(errors.thresholdValue).toBeDefined();
  });
});

describe("validateTripForm — track flags and city", () => {
  it("requires city when trackHotels is true", () => {
    const errors = validateTripForm(
      baseFormData({
        hotelPrefs: {
          rooms: "1",
          adultsPerRoom: "2",
          city: "   ",
          roomSelectionMode: "cheapest",
          roomTypes: [],
          views: [],
        },
      })
    );
    expect(errors.hotelCity).toBeDefined();
  });

  it("does not require city when trackHotels is false", () => {
    const errors = validateTripForm(
      baseFormData({
        trackFlights: true,
        trackHotels: false,
        hotelPrefs: {
          rooms: "1",
          adultsPerRoom: "2",
          city: "",
          roomSelectionMode: "cheapest",
          roomTypes: [],
          views: [],
        },
      })
    );
    expect(errors.hotelCity).toBeUndefined();
  });

  it("rejects when both track flags are off", () => {
    const errors = validateTripForm(
      baseFormData({ trackFlights: false, trackHotels: false })
    );
    expect(errors.tracking).toBeDefined();
  });

  it("accepts flights-only selection", () => {
    const errors = validateTripForm(
      baseFormData({ trackFlights: true, trackHotels: false })
    );
    expect(errors.tracking).toBeUndefined();
    expect(errors.hotelCity).toBeUndefined();
  });
});
