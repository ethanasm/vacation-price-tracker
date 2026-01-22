"use client";

import { useState, useCallback } from "react";
import { addDays } from "date-fns";
import type {
  TripFormData,
  TripFormErrors,
  TripFormSetters,
  TripPayload,
} from "../../components/trip-form/types";
import { validateTripForm, hasErrors } from "../../components/trip-form/validation";

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

export function useTripForm(
  initialData?: Partial<TripFormData>
): UseTripFormReturn {
  const [formData, setFormData] = useState<TripFormData>(() => ({
    ...getDefaultFormData(),
    ...initialData,
  }));
  const [errors, setErrors] = useState<TripFormErrors>({});

  // Create individual setters
  const setters: TripFormSetters = {
    setName: useCallback(
      (value: string) => setFormData((prev) => ({ ...prev, name: value })),
      []
    ),
    setOriginAirport: useCallback(
      (value: string) =>
        setFormData((prev) => ({ ...prev, originAirport: value })),
      []
    ),
    setDestinationCode: useCallback(
      (value: string) =>
        setFormData((prev) => ({ ...prev, destinationCode: value })),
      []
    ),
    setIsRoundTrip: useCallback(
      (value: boolean) =>
        setFormData((prev) => ({ ...prev, isRoundTrip: value })),
      []
    ),
    setDepartDate: useCallback(
      (value: Date | undefined) =>
        setFormData((prev) => ({ ...prev, departDate: value })),
      []
    ),
    setReturnDate: useCallback(
      (value: Date | undefined) =>
        setFormData((prev) => ({ ...prev, returnDate: value })),
      []
    ),
    setAdults: useCallback(
      (value: string) => setFormData((prev) => ({ ...prev, adults: value })),
      []
    ),
    setCabin: useCallback(
      (value: string) =>
        setFormData((prev) => ({
          ...prev,
          flightPrefs: { ...prev.flightPrefs, cabin: value },
        })),
      []
    ),
    setStopsMode: useCallback(
      (value: string) =>
        setFormData((prev) => ({
          ...prev,
          flightPrefs: { ...prev.flightPrefs, stopsMode: value },
        })),
      []
    ),
    setAirlines: useCallback(
      (value: string[]) =>
        setFormData((prev) => ({
          ...prev,
          flightPrefs: { ...prev.flightPrefs, airlines: value },
        })),
      []
    ),
    setRooms: useCallback(
      (value: string) =>
        setFormData((prev) => ({
          ...prev,
          hotelPrefs: { ...prev.hotelPrefs, rooms: value },
        })),
      []
    ),
    setAdultsPerRoom: useCallback(
      (value: string) =>
        setFormData((prev) => ({
          ...prev,
          hotelPrefs: { ...prev.hotelPrefs, adultsPerRoom: value },
        })),
      []
    ),
    setRoomSelectionMode: useCallback(
      (value: string) =>
        setFormData((prev) => ({
          ...prev,
          hotelPrefs: { ...prev.hotelPrefs, roomSelectionMode: value },
        })),
      []
    ),
    setRoomTypes: useCallback(
      (value: string[]) =>
        setFormData((prev) => ({
          ...prev,
          hotelPrefs: { ...prev.hotelPrefs, roomTypes: value },
        })),
      []
    ),
    setViews: useCallback(
      (value: string[]) =>
        setFormData((prev) => ({
          ...prev,
          hotelPrefs: { ...prev.hotelPrefs, views: value },
        })),
      []
    ),
    setThresholdType: useCallback(
      (value: string) =>
        setFormData((prev) => ({
          ...prev,
          notificationPrefs: { ...prev.notificationPrefs, thresholdType: value },
        })),
      []
    ),
    setThresholdValue: useCallback(
      (value: string) =>
        setFormData((prev) => ({
          ...prev,
          notificationPrefs: {
            ...prev.notificationPrefs,
            thresholdValue: value,
          },
        })),
      []
    ),
    setEmailEnabled: useCallback(
      (value: boolean) =>
        setFormData((prev) => ({
          ...prev,
          notificationPrefs: { ...prev.notificationPrefs, emailEnabled: value },
        })),
      []
    ),
    setSmsEnabled: useCallback(
      (value: boolean) =>
        setFormData((prev) => ({
          ...prev,
          notificationPrefs: { ...prev.notificationPrefs, smsEnabled: value },
        })),
      []
    ),
    setFlightPrefsOpen: useCallback(
      (value: boolean) =>
        setFormData((prev) => ({ ...prev, flightPrefsOpen: value })),
      []
    ),
    setHotelPrefsOpen: useCallback(
      (value: boolean) =>
        setFormData((prev) => ({ ...prev, hotelPrefsOpen: value })),
      []
    ),
  };

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

    const hasFlightPrefs = flightPrefsOpen || flightPrefs.airlines.length > 0;
    const hasHotelPrefs =
      hotelPrefsOpen ||
      hotelPrefs.roomTypes.length > 0 ||
      hotelPrefs.views.length > 0;

    return {
      name: formData.name.trim(),
      origin_airport: formData.originAirport.toUpperCase(),
      destination_code: formData.destinationCode.toUpperCase(),
      is_round_trip: formData.isRoundTrip,
      depart_date: formData.departDate?.toISOString().split("T")[0],
      return_date: formData.returnDate?.toISOString().split("T")[0],
      adults: Number.parseInt(formData.adults, 10),
      flight_prefs: hasFlightPrefs
        ? {
            airlines: flightPrefs.airlines,
            stops_mode: flightPrefs.stopsMode,
            max_stops: null,
            cabin: flightPrefs.cabin,
          }
        : null,
      hotel_prefs: hasHotelPrefs
        ? {
            rooms: Number.parseInt(hotelPrefs.rooms, 10),
            adults_per_room: Number.parseInt(hotelPrefs.adultsPerRoom, 10),
            room_selection_mode: hotelPrefs.roomSelectionMode,
            preferred_room_types: hotelPrefs.roomTypes,
            preferred_views: hotelPrefs.views,
          }
        : null,
      notification_prefs: {
        threshold_type: notificationPrefs.thresholdType,
        threshold_value: Number.parseFloat(notificationPrefs.thresholdValue),
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
