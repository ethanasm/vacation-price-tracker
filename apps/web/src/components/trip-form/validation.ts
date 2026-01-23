import type { TripFormData, TripFormErrors } from "./types";

const AIRPORT_CODE_REGEX = /^[A-Z]{3}$/;
const MAX_DATE_DAYS_OUT = 359;

export function validateName(name: string): string | undefined {
  if (!name.trim()) {
    return "Trip name is required";
  }
  if (name.length > 100) {
    return "Trip name must be 100 characters or less";
  }
  return undefined;
}

export function validateAirportCode(code: string): string | undefined {
  const normalized = code.trim().toUpperCase();
  if (!normalized.match(AIRPORT_CODE_REGEX)) {
    return "Enter a valid 3-letter airport code";
  }
  return undefined;
}

export function validateDepartDate(
  departDate: Date | undefined
): string | undefined {
  if (!departDate) {
    return "Departure date is required";
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dateOnly = new Date(departDate);
  dateOnly.setHours(0, 0, 0, 0);
  if (dateOnly < today) {
    return "Departure date cannot be in the past";
  }
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + MAX_DATE_DAYS_OUT);
  if (dateOnly > maxDate) {
    return `Departure date cannot be more than ${MAX_DATE_DAYS_OUT} days out`;
  }
  return undefined;
}

export function validateReturnDate(
  returnDate: Date | undefined,
  departDate: Date | undefined
): string | undefined {
  if (!returnDate) {
    return "Return date is required";
  }
  if (departDate && returnDate <= departDate) {
    return "Return date must be after departure";
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + MAX_DATE_DAYS_OUT);
  const dateOnly = new Date(returnDate);
  dateOnly.setHours(0, 0, 0, 0);
  if (dateOnly > maxDate) {
    return `Return date cannot be more than ${MAX_DATE_DAYS_OUT} days out`;
  }
  return undefined;
}

export function validateThresholdValue(value: string): string | undefined {
  if (!value.trim() || Number.parseFloat(value) <= 0) {
    return "Enter a valid price threshold";
  }
  return undefined;
}

export function validateTripForm(data: TripFormData): TripFormErrors {
  const errors: TripFormErrors = {};

  const nameError = validateName(data.name);
  if (nameError) errors.name = nameError;

  const originError = validateAirportCode(data.originAirport);
  if (originError) errors.originAirport = originError;

  const destinationError = validateAirportCode(data.destinationCode);
  if (destinationError) errors.destinationCode = destinationError;

  const departError = validateDepartDate(data.departDate);
  if (departError) errors.departDate = departError;

  if (data.isRoundTrip || data.returnDate) {
    const returnError = validateReturnDate(data.returnDate, data.departDate);
    if (returnError) errors.returnDate = returnError;
  }

  const thresholdError = validateThresholdValue(
    data.notificationPrefs.thresholdValue
  );
  if (thresholdError) errors.thresholdValue = thresholdError;

  return errors;
}

export function hasErrors(errors: TripFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
