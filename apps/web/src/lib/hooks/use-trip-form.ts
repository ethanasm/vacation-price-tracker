"use client";

import { useState, useCallback, useMemo } from "react";
import { addDays, parseISO } from "date-fns";
import type {
  TripFormData,
  TripFormErrors,
  TripFormSetters,
  TripPayload,
} from "../../components/trip-form/types";
import { validateTripForm, hasErrors } from "../../components/trip-form/validation";
import type { TripDetail, CabinClass, StopsMode, RoomSelectionMode, ThresholdType } from "../api";

interface UseTripFormReturn {
  formData: TripFormData;
  setters: TripFormSetters;
  errors: TripFormErrors;
  validate: () => boolean;
  reset: () => void;
  getPayload: () => TripPayload;
}

const getDefaultFormData = (): TripFormData => ({
  // Basic info
  name: "",
  originAirport: "",
  destinationCode: "",
  isRoundTrip: true,
  departDate: addDays(new Date(), 30),
  returnDate: addDays(new Date(), 37),
  adults: "1",

  // Flight preferences
  flightPrefs: {
    cabin: "economy",
    stopsMode: "any",
    airlines: [],
  },

  // Hotel preferences
  hotelPrefs: {
    rooms: "1",
    adultsPerRoom: "2",
    roomSelectionMode: "cheapest",
    roomTypes: [],
    views: [],
  },

  // Notification preferences
  notificationPrefs: {
    thresholdType: "trip_total",
    thresholdValue: "",
    emailEnabled: true,
    smsEnabled: false,
  },

  // Section collapse state
  flightPrefsOpen: false,
  hotelPrefsOpen: false,
});

/**
 * Convert a TripDetail from the API to TripFormData for form initialization.
 * Used when editing an existing trip.
 */
export function tripDetailToFormData(trip: TripDetail): TripFormData {
  const hasFlightPrefs = trip.flight_prefs !== null;
  const hasHotelPrefs = trip.hotel_prefs !== null;

  return {
    // Basic info
    name: trip.name,
    originAirport: trip.origin_airport,
    destinationCode: trip.destination_code,
    isRoundTrip: trip.is_round_trip,
    departDate: trip.depart_date ? parseISO(trip.depart_date) : undefined,
    returnDate: trip.return_date ? parseISO(trip.return_date) : undefined,
    adults: String(trip.adults),

    // Flight preferences
    flightPrefs: {
      cabin: trip.flight_prefs?.cabin ?? "economy",
      stopsMode: trip.flight_prefs?.stops_mode ?? "any",
      airlines: trip.flight_prefs?.airlines ?? [],
    },

    // Hotel preferences
    hotelPrefs: {
      rooms: String(trip.hotel_prefs?.rooms ?? 1),
      adultsPerRoom: String(trip.hotel_prefs?.adults_per_room ?? 2),
      roomSelectionMode: trip.hotel_prefs?.room_selection_mode ?? "cheapest",
      roomTypes: trip.hotel_prefs?.preferred_room_types ?? [],
      views: trip.hotel_prefs?.preferred_views ?? [],
    },

    // Notification preferences
    notificationPrefs: {
      thresholdType: trip.notification_prefs?.threshold_type ?? "trip_total",
      thresholdValue: trip.notification_prefs?.threshold_value ?? "",
      emailEnabled: trip.notification_prefs?.email_enabled ?? true,
      smsEnabled: trip.notification_prefs?.sms_enabled ?? false,
    },

    // Open sections if they have data
    flightPrefsOpen: hasFlightPrefs,
    hotelPrefsOpen: hasHotelPrefs,
  };
}

const formatDateForApi = (date: Date | undefined): string => {
  if (!date) {
    throw new Error("Date is required but was not provided. Ensure form validation runs before getPayload.");
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatDateForApiOptional = (date: Date | undefined): string | undefined => {
  if (!date) return undefined;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const parseNumber = (value: string, fallback: number): number => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export function useTripForm(
  initialData?: Partial<TripFormData>
): UseTripFormReturn {
  const [formData, setFormData] = useState<TripFormData>(() => ({
    ...getDefaultFormData(),
    ...initialData,
  }));
  const [errors, setErrors] = useState<TripFormErrors>({});

  // Create individual setters (memoized to prevent re-creation on every render)
  const setName = useCallback(
    (value: string) => setFormData((prev) => ({ ...prev, name: value })),
    []
  );
  const setOriginAirport = useCallback(
    (value: string) =>
      setFormData((prev) => ({ ...prev, originAirport: value })),
    []
  );
  const setDestinationCode = useCallback(
    (value: string) =>
      setFormData((prev) => ({ ...prev, destinationCode: value })),
    []
  );
  const setIsRoundTrip = useCallback(
    (value: boolean) =>
      setFormData((prev) => ({ ...prev, isRoundTrip: value })),
    []
  );
  const setDepartDate = useCallback(
    (value: Date | undefined) =>
      setFormData((prev) => ({ ...prev, departDate: value })),
    []
  );
  const setReturnDate = useCallback(
    (value: Date | undefined) =>
      setFormData((prev) => ({ ...prev, returnDate: value })),
    []
  );
  const setAdults = useCallback(
    (value: string) => setFormData((prev) => ({ ...prev, adults: value })),
    []
  );
  const setCabin = useCallback(
    (value: string) =>
      setFormData((prev) => ({
        ...prev,
        flightPrefs: { ...prev.flightPrefs, cabin: value },
      })),
    []
  );
  const setStopsMode = useCallback(
    (value: string) =>
      setFormData((prev) => ({
        ...prev,
        flightPrefs: { ...prev.flightPrefs, stopsMode: value },
      })),
    []
  );
  const setAirlines = useCallback(
    (value: string[]) =>
      setFormData((prev) => ({
        ...prev,
        flightPrefs: { ...prev.flightPrefs, airlines: value },
      })),
    []
  );
  const setRooms = useCallback(
    (value: string) =>
      setFormData((prev) => ({
        ...prev,
        hotelPrefs: { ...prev.hotelPrefs, rooms: value },
      })),
    []
  );
  const setAdultsPerRoom = useCallback(
    (value: string) =>
      setFormData((prev) => ({
        ...prev,
        hotelPrefs: { ...prev.hotelPrefs, adultsPerRoom: value },
      })),
    []
  );
  const setRoomSelectionMode = useCallback(
    (value: string) =>
      setFormData((prev) => ({
        ...prev,
        hotelPrefs: { ...prev.hotelPrefs, roomSelectionMode: value },
      })),
    []
  );
  const setRoomTypes = useCallback(
    (value: string[]) =>
      setFormData((prev) => ({
        ...prev,
        hotelPrefs: { ...prev.hotelPrefs, roomTypes: value },
      })),
    []
  );
  const setViews = useCallback(
    (value: string[]) =>
      setFormData((prev) => ({
        ...prev,
        hotelPrefs: { ...prev.hotelPrefs, views: value },
      })),
    []
  );
  const setThresholdType = useCallback(
    (value: string) =>
      setFormData((prev) => ({
        ...prev,
        notificationPrefs: { ...prev.notificationPrefs, thresholdType: value },
      })),
    []
  );
  const setThresholdValue = useCallback(
    (value: string) =>
      setFormData((prev) => ({
        ...prev,
        notificationPrefs: {
          ...prev.notificationPrefs,
          thresholdValue: value,
        },
      })),
    []
  );
  const setEmailEnabled = useCallback(
    (value: boolean) =>
      setFormData((prev) => ({
        ...prev,
        notificationPrefs: { ...prev.notificationPrefs, emailEnabled: value },
      })),
    []
  );
  const setSmsEnabled = useCallback(
    (value: boolean) =>
      setFormData((prev) => ({
        ...prev,
        notificationPrefs: { ...prev.notificationPrefs, smsEnabled: value },
      })),
    []
  );
  const setFlightPrefsOpen = useCallback(
    (value: boolean) =>
      setFormData((prev) => ({ ...prev, flightPrefsOpen: value })),
    []
  );
  const setHotelPrefsOpen = useCallback(
    (value: boolean) =>
      setFormData((prev) => ({ ...prev, hotelPrefsOpen: value })),
    []
  );

  // Memoize the setters object to keep it stable across renders
  const setters: TripFormSetters = useMemo(
    () => ({
      setName,
      setOriginAirport,
      setDestinationCode,
      setIsRoundTrip,
      setDepartDate,
      setReturnDate,
      setAdults,
      setCabin,
      setStopsMode,
      setAirlines,
      setRooms,
      setAdultsPerRoom,
      setRoomSelectionMode,
      setRoomTypes,
      setViews,
      setThresholdType,
      setThresholdValue,
      setEmailEnabled,
      setSmsEnabled,
      setFlightPrefsOpen,
      setHotelPrefsOpen,
    }),
    [
      setName,
      setOriginAirport,
      setDestinationCode,
      setIsRoundTrip,
      setDepartDate,
      setReturnDate,
      setAdults,
      setCabin,
      setStopsMode,
      setAirlines,
      setRooms,
      setAdultsPerRoom,
      setRoomSelectionMode,
      setRoomTypes,
      setViews,
      setThresholdType,
      setThresholdValue,
      setEmailEnabled,
      setSmsEnabled,
      setFlightPrefsOpen,
      setHotelPrefsOpen,
    ]
  );

  const validate = useCallback((): boolean => {
    const newErrors = validateTripForm(formData);
    setErrors(newErrors);
    return !hasErrors(newErrors);
  }, [formData]);

  const reset = useCallback(() => {
    setFormData(getDefaultFormData());
    setErrors({});
  }, []);

  const getPayload = useCallback((): TripPayload => {
    const { flightPrefs, hotelPrefs, notificationPrefs, flightPrefsOpen, hotelPrefsOpen } =
      formData;
    const thresholdValue = Number.parseFloat(notificationPrefs.thresholdValue);

    const hasFlightPrefs = flightPrefsOpen || flightPrefs.airlines.length > 0;
    const hasHotelPrefs =
      hotelPrefsOpen ||
      hotelPrefs.roomTypes.length > 0 ||
      hotelPrefs.views.length > 0;

    return {
      name: formData.name.trim(),
      origin_airport: formData.originAirport.trim().toUpperCase(),
      destination_code: formData.destinationCode.trim().toUpperCase(),
      is_round_trip: formData.isRoundTrip,
      depart_date: formatDateForApi(formData.departDate),
      // Return date is always required by API; for one-way trips, use depart_date
      return_date: formData.isRoundTrip
        ? formatDateForApi(formData.returnDate)
        : formatDateForApi(formData.departDate),
      adults: parseNumber(formData.adults, 1),
      flight_prefs: hasFlightPrefs
        ? {
            airlines: flightPrefs.airlines,
            stops_mode: flightPrefs.stopsMode as StopsMode,
            max_stops: null,
            cabin: flightPrefs.cabin as CabinClass,
          }
        : null,
      hotel_prefs: hasHotelPrefs
        ? {
            rooms: parseNumber(hotelPrefs.rooms, 1),
            adults_per_room: parseNumber(hotelPrefs.adultsPerRoom, 1),
            room_selection_mode: hotelPrefs.roomSelectionMode as RoomSelectionMode,
            preferred_room_types: hotelPrefs.roomTypes,
            preferred_views: hotelPrefs.views,
          }
        : null,
      notification_prefs: {
        threshold_type: notificationPrefs.thresholdType as ThresholdType,
        threshold_value: Number.isFinite(thresholdValue) ? thresholdValue : 0,
        notify_without_threshold: false,
        email_enabled: notificationPrefs.emailEnabled,
        sms_enabled: notificationPrefs.smsEnabled,
      },
    };
  }, [formData]);

  return {
    formData,
    setters,
    errors,
    validate,
    reset,
    getPayload,
  };
}
