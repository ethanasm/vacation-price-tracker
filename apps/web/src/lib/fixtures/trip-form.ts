import type { TripFormData, TripFormErrors, TripPayload } from "@/components/trip-form/types";

// Create dynamic dates that are always valid (30 days and 40 days from now)
const getBaseDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  date.setHours(0, 0, 0, 0);
  return date;
};

const getReturnDate = () => {
  const date = new Date();
  date.setDate(date.getDate() + 40);
  date.setHours(0, 0, 0, 0);
  return date;
};

// Format date as YYYY-MM-DD for API payloads
const formatDate = (date: Date) => date.toISOString().split("T")[0];

export const baseTripFormData: TripFormData = {
  name: "Summer Trip",
  originAirport: "SFO",
  destinationCode: "LAX",
  isRoundTrip: true,
  departDate: getBaseDate(),
  returnDate: getReturnDate(),
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
    emailEnabled: false,
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
  depart_date: formatDate(getBaseDate()),
  return_date: formatDate(getReturnDate()),
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
