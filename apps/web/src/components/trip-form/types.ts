import type {
  CabinClass,
  StopsMode,
  RoomSelectionMode,
  ThresholdType,
} from "@/lib/api";

export interface FlightPrefsData {
  cabin: string;
  stopsMode: string;
  airlines: string[];
}

export interface HotelPrefsData {
  rooms: string;
  adultsPerRoom: string;
  roomSelectionMode: string;
  roomTypes: string[];
  views: string[];
}

export interface NotificationPrefsData {
  thresholdType: string;
  thresholdValue: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
}

export interface TripFormData {
  // Basic info
  name: string;
  originAirport: string;
  destinationCode: string;
  isRoundTrip: boolean;
  departDate: Date | undefined;
  returnDate: Date | undefined;
  adults: string;

  // Flight preferences
  flightPrefs: FlightPrefsData;

  // Hotel preferences
  hotelPrefs: HotelPrefsData;

  // Notification preferences
  notificationPrefs: NotificationPrefsData;

  // Section collapse state
  flightPrefsOpen: boolean;
  hotelPrefsOpen: boolean;
}

export interface TripFormErrors {
  name?: string;
  originAirport?: string;
  destinationCode?: string;
  departDate?: string;
  returnDate?: string;
  thresholdValue?: string;
}

export interface TripFormSetters {
  setName: (value: string) => void;
  setOriginAirport: (value: string) => void;
  setDestinationCode: (value: string) => void;
  setIsRoundTrip: (value: boolean) => void;
  setDepartDate: (value: Date | undefined) => void;
  setReturnDate: (value: Date | undefined) => void;
  setAdults: (value: string) => void;
  setCabin: (value: string) => void;
  setStopsMode: (value: string) => void;
  setAirlines: (value: string[]) => void;
  setRooms: (value: string) => void;
  setAdultsPerRoom: (value: string) => void;
  setRoomSelectionMode: (value: string) => void;
  setRoomTypes: (value: string[]) => void;
  setViews: (value: string[]) => void;
  setThresholdType: (value: string) => void;
  setThresholdValue: (value: string) => void;
  setEmailEnabled: (value: boolean) => void;
  setSmsEnabled: (value: boolean) => void;
  setFlightPrefsOpen: (value: boolean) => void;
  setHotelPrefsOpen: (value: boolean) => void;
}

/**
 * Payload for creating or updating a trip.
 * Uses enum types from the generated API for type safety.
 * Dates are required (form validation ensures they're present before submission).
 */
export interface TripPayload {
  name: string;
  origin_airport: string;
  destination_code: string;
  is_round_trip: boolean;
  depart_date: string;
  return_date: string;
  adults: number;
  flight_prefs: {
    airlines: string[];
    stops_mode: StopsMode;
    max_stops: number | null;
    cabin: CabinClass;
  } | null;
  hotel_prefs: {
    rooms: number;
    adults_per_room: number;
    room_selection_mode: RoomSelectionMode;
    preferred_room_types: string[];
    preferred_views: string[];
  } | null;
  notification_prefs: {
    threshold_type: ThresholdType;
    threshold_value: number;
    notify_without_threshold: boolean;
    email_enabled: boolean;
    sms_enabled: boolean;
  };
}
