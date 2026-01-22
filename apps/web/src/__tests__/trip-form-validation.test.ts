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
    expect(validateDepartDate(new Date())).toBeUndefined();
  });

  it("validates return dates", () => {
    const departDate = new Date(2025, 5, 10);
    const returnDate = new Date(2025, 5, 9);
    expect(validateReturnDate(undefined, departDate)).toBe("Return date is required");
    expect(validateReturnDate(returnDate, departDate)).toBe(
      "Return date must be after departure"
    );
    expect(validateReturnDate(new Date(2025, 5, 12), departDate)).toBeUndefined();
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

  it("flags return date errors for one-way trips when return date is set", () => {
    const errors = validateTripForm({
      ...baseTripFormData,
      isRoundTrip: false,
      returnDate: new Date(2025, 5, 9),
    });

    expect(errors.returnDate).toBeDefined();
  });

  it("reports no errors for valid data", () => {
    const errors = validateTripForm(baseTripFormData);
    expect(hasErrors(errors)).toBe(false);
  });
});
