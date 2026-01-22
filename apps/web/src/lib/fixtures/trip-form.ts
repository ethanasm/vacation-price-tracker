import type { TripFormData, TripFormErrors, TripPayload } from "@/components/trip-form/types";

export const baseTripFormData: TripFormData = {
  name: "Summer Trip",
  originAirport: "SFO",
  destinationCode: "LAX",
  isRoundTrip: true,
  departDate: new Date(2025, 5, 10),
  returnDate: new Date(2025, 5, 20),
  adults: "1",
  flightPrefs: {
    cabin: "economy",
    stopsMode: "any",
    airlines: [],
  },
  hotelPrefs: {
    rooms: "1",
    adultsPerRoom: "2",
    roomSelectionMode: "cheapest",
    roomTypes: [],
    views: [],
  },
  notificationPrefs: {
    thresholdType: "trip_total",
    thresholdValue: "1000",
    emailEnabled: true,
    smsEnabled: false,
  },
  flightPrefsOpen: false,
  hotelPrefsOpen: false,
};

export const emptyTripFormErrors: TripFormErrors = {};

export const tripFormErrorsFixture: TripFormErrors = {
  name: "Trip name is required",
  originAirport: "Enter a valid 3-letter airport code",
  destinationCode: "Enter a valid 3-letter airport code",
  departDate: "Departure date is required",
  returnDate: "Return date must be after departure",
  thresholdValue: "Enter a valid price threshold",
};

export const tripPayloadFixture: TripPayload = {
  name: "Summer Trip",
  origin_airport: "SFO",
  destination_code: "LAX",
  is_round_trip: true,
  depart_date: "2025-06-10",
  return_date: "2025-06-20",
  adults: 1,
  flight_prefs: null,
  hotel_prefs: null,
  notification_prefs: {
    threshold_type: "trip_total",
    threshold_value: 1000,
    notify_without_threshold: false,
    email_enabled: true,
    sms_enabled: false,
  },
};
