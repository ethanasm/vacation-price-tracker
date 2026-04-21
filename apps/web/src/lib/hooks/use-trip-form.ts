"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { addDays, parseISO } from "date-fns";
import type {
  TripFormData,
  TripFormErrors,
  TripFormSetters,
  TripFormTouched,
  TripPayload,
} from "../../components/trip-form/types";
import { validateTripForm, hasErrors } from "../../components/trip-form/validation";
import { MIN_STAR_RATING_ANY } from "../../components/trip-form/constants";
import type { TripDetail, CabinClass, StopsMode, RoomSelectionMode, ThresholdType } from "../api";

interface UseTripFormReturn {
  formData: TripFormData;
  setters: TripFormSetters;
  errors: TripFormErrors;
  isValid: boolean;
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
  departDate: addDays(new Date(), 1),
  returnDate: addDays(new Date(), 8),
  adults: "1",

  // Tracking
  trackFlights: true,
  trackHotels: true,

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
    city: "",
    roomSelectionMode: "cheapest",
    roomTypes: [],
    views: [],
    minStarRating: MIN_STAR_RATING_ANY,
  },

  // Notification preferences
  notificationPrefs: {
    thresholdType: "trip_total",
    thresholdValue: "",
    emailEnabled: false,
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
  const hasFlightPrefs = trip.flight_prefs !== null && trip.flight_prefs !== undefined;
  const hasHotelPrefs = trip.hotel_prefs !== null && trip.hotel_prefs !== undefined;

  return {
    name: trip.name,
    originAirport: trip.origin_airport,
    destinationCode: trip.destination_code,
    isRoundTrip: trip.is_round_trip,
    departDate: trip.depart_date ? parseISO(trip.depart_date) : undefined,
    returnDate: trip.return_date ? parseISO(trip.return_date) : undefined,
    adults: String(trip.adults),

    trackFlights: trip.track_flights ?? hasFlightPrefs,
    trackHotels: trip.track_hotels ?? hasHotelPrefs,

    flightPrefs: {
      cabin: trip.flight_prefs?.cabin ?? "economy",
      stopsMode: trip.flight_prefs?.stops_mode ?? "any",
      airlines: trip.flight_prefs?.airlines ?? [],
    },

    hotelPrefs: {
      rooms: String(trip.hotel_prefs?.rooms ?? 1),
      adultsPerRoom: String(trip.hotel_prefs?.adults_per_room ?? 2),
      city: trip.hotel_prefs?.city ?? "",
      roomSelectionMode: trip.hotel_prefs?.room_selection_mode ?? "cheapest",
      roomTypes: trip.hotel_prefs?.preferred_room_types ?? [],
      views: trip.hotel_prefs?.preferred_views ?? [],
      minStarRating: trip.hotel_prefs?.min_star_rating != null
        ? String(trip.hotel_prefs.min_star_rating)
        : MIN_STAR_RATING_ANY,
    },

    notificationPrefs: {
      thresholdType: trip.notification_prefs?.threshold_type ?? "trip_total",
      thresholdValue: trip.notification_prefs?.threshold_value ?? "",
      emailEnabled: trip.notification_prefs?.email_enabled ?? false,
      smsEnabled: trip.notification_prefs?.sms_enabled ?? false,
    },

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
  const [touched, setTouched] = useState<TripFormTouched>({});
  const allTouchedRef = useRef(false);

  const touch = useCallback((field: keyof TripFormTouched) => {
    setTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  }, []);

  // Create individual setters (memoized to prevent re-creation on every render)
  const setName = useCallback(
    (value: string) => {
      touch("name");
      setFormData((prev) => ({ ...prev, name: value }));
    },
    [touch]
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
  const blurOriginAirport = useCallback(() => touch("originAirport"), [touch]);
  const blurDestinationCode = useCallback(
    () => touch("destinationCode"),
    [touch]
  );
  const setIsRoundTrip = useCallback(
    (value: boolean) =>
      setFormData((prev) => ({
        ...prev,
        isRoundTrip: value,
        returnDate: value ? prev.returnDate : undefined,
      })),
    []
  );
  const setDepartDate = useCallback(
    (value: Date | undefined) => {
      touch("departDate");
      setFormData((prev) => ({ ...prev, departDate: value }));
    },
    [touch]
  );
  const setReturnDate = useCallback(
    (value: Date | undefined) => {
      touch("returnDate");
      setFormData((prev) => ({ ...prev, returnDate: value }));
    },
    [touch]
  );
  const setAdults = useCallback(
    (value: string) => setFormData((prev) => ({ ...prev, adults: value })),
    []
  );
  const setTrackFlights = useCallback(
    (value: boolean) => setFormData((prev) => ({ ...prev, trackFlights: value })),
    []
  );
  const setTrackHotels = useCallback(
    (value: boolean) => setFormData((prev) => ({ ...prev, trackHotels: value })),
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
  const setCity = useCallback(
    (value: string) => {
      touch("hotelCity");
      setFormData((prev) => ({
        ...prev,
        hotelPrefs: { ...prev.hotelPrefs, city: value },
      }));
    },
    [touch]
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
  const setMinStarRating = useCallback(
    (value: string) =>
      setFormData((prev) => ({
        ...prev,
        hotelPrefs: { ...prev.hotelPrefs, minStarRating: value },
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
    (value: string) => {
      touch("thresholdValue");
      setFormData((prev) => ({
        ...prev,
        notificationPrefs: {
          ...prev.notificationPrefs,
          thresholdValue: value,
        },
      }));
    },
    [touch]
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
      blurOriginAirport,
      blurDestinationCode,
      setIsRoundTrip,
      setDepartDate,
      setReturnDate,
      setAdults,
      setTrackFlights,
      setTrackHotels,
      setCabin,
      setStopsMode,
      setAirlines,
      setRooms,
      setAdultsPerRoom,
      setCity,
      setRoomSelectionMode,
      setRoomTypes,
      setViews,
      setMinStarRating,
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
      blurOriginAirport,
      blurDestinationCode,
      setIsRoundTrip,
      setDepartDate,
      setReturnDate,
      setAdults,
      setTrackFlights,
      setTrackHotels,
      setCabin,
      setStopsMode,
      setAirlines,
      setRooms,
      setAdultsPerRoom,
      setCity,
      setRoomSelectionMode,
      setRoomTypes,
      setViews,
      setMinStarRating,
      setThresholdType,
      setThresholdValue,
      setEmailEnabled,
      setSmsEnabled,
      setFlightPrefsOpen,
      setHotelPrefsOpen,
    ]
  );

  // Live validation: re-validate on every form change, only show errors for touched fields
  const allErrors = useMemo(() => validateTripForm(formData), [formData]);

  useEffect(() => {
    if (allTouchedRef.current) {
      setErrors(allErrors);
    } else {
      // Only show errors for touched fields
      const visibleErrors: TripFormErrors = {};
      for (const key of Object.keys(touched) as (keyof TripFormTouched)[]) {
        if (touched[key] && allErrors[key]) {
          visibleErrors[key] = allErrors[key];
        }
      }
      setErrors(visibleErrors);
    }
  }, [allErrors, touched]);

  // TODO(task-10): move into validateTripForm
  const trackingError = !formData.trackFlights && !formData.trackHotels;
  const isValid = !hasErrors(allErrors) && !trackingError;

  const validate = useCallback((): boolean => {
    allTouchedRef.current = true;
    const newErrors = validateTripForm(formData);
    setErrors(newErrors);
    return !hasErrors(newErrors);
  }, [formData]);

  const reset = useCallback(() => {
    setFormData(getDefaultFormData());
    setErrors({});
    setTouched({});
    allTouchedRef.current = false;
  }, []);

  const getPayload = useCallback((): TripPayload => {
    const {
      flightPrefs,
      hotelPrefs,
      notificationPrefs,
      trackFlights,
      trackHotels,
    } = formData;
    const notificationsEnabled =
      notificationPrefs.emailEnabled || notificationPrefs.smsEnabled;
    const thresholdValue = notificationsEnabled
      ? Number.parseFloat(notificationPrefs.thresholdValue)
      : 0;

    return {
      name: formData.name.trim(),
      origin_airport: formData.originAirport.trim().toUpperCase(),
      destination_code: formData.destinationCode.trim().toUpperCase(),
      is_round_trip: formData.isRoundTrip,
      depart_date: formatDateForApi(formData.departDate),
      return_date: formData.isRoundTrip
        ? formatDateForApi(formData.returnDate)
        : null,
      adults: parseNumber(formData.adults, 1),
      track_flights: trackFlights,
      track_hotels: trackHotels,
      flight_prefs: trackFlights
        ? {
            airlines: flightPrefs.airlines,
            stops_mode: flightPrefs.stopsMode as StopsMode,
            max_stops: null,
            cabin: flightPrefs.cabin as CabinClass,
          }
        : null,
      hotel_prefs: trackHotels
        ? {
            rooms: parseNumber(hotelPrefs.rooms, 1),
            adults_per_room: parseNumber(hotelPrefs.adultsPerRoom, 1),
            city: hotelPrefs.city.trim(),
            room_selection_mode: hotelPrefs.roomSelectionMode as RoomSelectionMode,
            preferred_room_types: hotelPrefs.roomTypes,
            preferred_views: hotelPrefs.views,
            min_star_rating:
              hotelPrefs.minStarRating && hotelPrefs.minStarRating !== MIN_STAR_RATING_ANY
                ? parseNumber(hotelPrefs.minStarRating, 0) || null
                : null,
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
    isValid,
    validate,
    reset,
    getPayload,
  };
}
