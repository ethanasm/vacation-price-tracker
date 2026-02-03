// Types
export type {
  TripFormData,
  TripFormErrors,
  TripFormSetters,
  TripPayload,
  FlightPrefsData,
  HotelPrefsData,
  NotificationPrefsData,
} from "./types";

// Constants
export {
  CABIN_CLASSES,
  STOPS_MODES,
  ROOM_SELECTION_MODES,
  THRESHOLD_TYPES,
  ROOM_TYPES,
  VIEW_TYPES,
  TRAVELER_COUNTS,
  ROOM_COUNTS,
  ADULTS_PER_ROOM_COUNTS,
} from "./constants";

// Validation
export {
  validateTripForm,
  validateName,
  validateAirportCode,
  validateDepartDate,
  validateReturnDate,
  validateThresholdValue,
  hasErrors,
} from "./validation";

// Components
export { TagInput } from "./tag-input";
export type { TagInputProps } from "./tag-input";

export { CollapsibleSection } from "./collapsible-section";
export type { CollapsibleSectionProps } from "./collapsible-section";

export { TripDetailsSection } from "./trip-details-section";
export type { TripDetailsSectionProps } from "./trip-details-section";

export { FlightPrefsSection } from "./flight-prefs-section";
export type { FlightPrefsSectionProps } from "./flight-prefs-section";

export { HotelPrefsSection } from "./hotel-prefs-section";
export type { HotelPrefsSectionProps } from "./hotel-prefs-section";

export { NotificationSection } from "./notification-section";
export type { NotificationSectionProps } from "./notification-section";

export { AirportAutocomplete } from "./airport-autocomplete";
export type { AirportAutocompleteProps, Location } from "./airport-autocomplete";

export { ChatTripForm } from "./chat-trip-form";
export type { ChatTripFormProps, ChatTripFormPrefilled } from "./chat-trip-form";
