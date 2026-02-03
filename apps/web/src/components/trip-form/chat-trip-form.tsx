"use client";

import { useCallback, useMemo } from "react";
import { Button } from "../ui/button";
import { TripDetailsSection } from "./trip-details-section";
import { FlightPrefsSection } from "./flight-prefs-section";
import { HotelPrefsSection } from "./hotel-prefs-section";
import { useTripForm } from "../../lib/hooks/use-trip-form";
import { api } from "../../lib/api";
import type { TripFormData, TripPayload } from "./types";
import type { Location } from "./airport-autocomplete";

/**
 * Prefilled data from the LLM conversation.
 * Maps backend snake_case field names to form values.
 */
export interface ChatTripFormPrefilled {
  name?: string;
  origin_airport?: string;
  destination_code?: string;
  depart_date?: string;
  return_date?: string;
  adults?: number;
  is_round_trip?: boolean;
  // Flight preferences
  cabin?: string;
  stops_mode?: string;
  airlines?: string[];
  // Hotel preferences
  hotel_rooms?: number;
  adults_per_room?: number;
  room_selection_mode?: string;
  room_types?: string[];
  views?: string[];
}

export interface ChatTripFormProps {
  /** Values already captured from the conversation */
  prefilled: ChatTripFormPrefilled;
  /** Called when form is submitted with complete data */
  onSubmit: (data: TripPayload) => void;
  /** Called when user cancels the form */
  onCancel: () => void;
  /** Whether the form is currently submitting */
  isSubmitting?: boolean;
}

/**
 * Convert prefilled data from the LLM to TripFormData format.
 * Handles conversion from backend snake_case to form camelCase.
 */
function prefilledToFormData(prefilled: ChatTripFormPrefilled): Partial<TripFormData> {
  const data: Partial<TripFormData> = {};

  if (prefilled.name) {
    data.name = prefilled.name;
  }
  if (prefilled.origin_airport) {
    data.originAirport = prefilled.origin_airport.toUpperCase();
  }
  if (prefilled.destination_code) {
    data.destinationCode = prefilled.destination_code.toUpperCase();
  }
  if (prefilled.depart_date) {
    data.departDate = new Date(prefilled.depart_date);
  }
  if (prefilled.return_date) {
    data.returnDate = new Date(prefilled.return_date);
  }
  if (prefilled.adults !== undefined) {
    data.adults = String(prefilled.adults);
  }
  if (prefilled.is_round_trip !== undefined) {
    data.isRoundTrip = prefilled.is_round_trip;
  }

  // Flight preferences
  const hasFlightPrefs = prefilled.cabin || prefilled.stops_mode || prefilled.airlines?.length;
  if (hasFlightPrefs) {
    data.flightPrefs = {
      cabin: prefilled.cabin || "economy",
      stopsMode: prefilled.stops_mode || "any",
      airlines: prefilled.airlines || [],
    };
    data.flightPrefsOpen = true;
  }

  // Hotel preferences
  const hasHotelPrefs =
    prefilled.hotel_rooms ||
    prefilled.adults_per_room ||
    prefilled.room_selection_mode ||
    prefilled.room_types?.length ||
    prefilled.views?.length;
  if (hasHotelPrefs) {
    data.hotelPrefs = {
      rooms: String(prefilled.hotel_rooms || 1),
      adultsPerRoom: String(prefilled.adults_per_room || 2),
      roomSelectionMode: prefilled.room_selection_mode || "cheapest",
      roomTypes: prefilled.room_types || [],
      views: prefilled.views || [],
    };
    data.hotelPrefsOpen = true;
  }

  return data;
}

/**
 * ChatTripForm is a simplified trip form for use in the chat elicitation drawer.
 * It wraps the existing TripDetailsSection, FlightPrefsSection, and HotelPrefsSection
 * components and handles prefilling from LLM conversation data.
 *
 * Unlike the full create trip page, this form:
 * - Does not include NotificationSection (can be configured later)
 * - Has a more compact layout suitable for a drawer
 * - Handles conversion from LLM prefilled data format
 */
export function ChatTripForm({
  prefilled,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: ChatTripFormProps) {
  // Convert prefilled data to form format
  const initialData = useMemo(() => prefilledToFormData(prefilled), [prefilled]);

  const { formData, setters, errors, isValid, validate, getPayload } =
    useTripForm(initialData);

  // Memoized search function that uses static airport data
  const searchLocations = useCallback((query: string): Location[] => {
    return api.locations.search(query);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const payload = getPayload();
    onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <TripDetailsSection
        name={formData.name}
        originAirport={formData.originAirport}
        destinationCode={formData.destinationCode}
        isRoundTrip={formData.isRoundTrip}
        departDate={formData.departDate}
        returnDate={formData.returnDate}
        adults={formData.adults}
        errors={errors}
        onNameChange={setters.setName}
        onOriginAirportChange={setters.setOriginAirport}
        onDestinationCodeChange={setters.setDestinationCode}
        onIsRoundTripChange={setters.setIsRoundTrip}
        onDepartDateChange={setters.setDepartDate}
        onReturnDateChange={setters.setReturnDate}
        onAdultsChange={setters.setAdults}
        searchLocations={searchLocations}
      />

      <FlightPrefsSection
        isOpen={formData.flightPrefsOpen}
        cabin={formData.flightPrefs.cabin}
        stopsMode={formData.flightPrefs.stopsMode}
        airlines={formData.flightPrefs.airlines}
        onToggle={() => setters.setFlightPrefsOpen(!formData.flightPrefsOpen)}
        onCabinChange={setters.setCabin}
        onStopsModeChange={setters.setStopsMode}
        onAirlinesChange={setters.setAirlines}
      />

      <HotelPrefsSection
        isOpen={formData.hotelPrefsOpen}
        rooms={formData.hotelPrefs.rooms}
        adultsPerRoom={formData.hotelPrefs.adultsPerRoom}
        roomSelectionMode={formData.hotelPrefs.roomSelectionMode}
        roomTypes={formData.hotelPrefs.roomTypes}
        views={formData.hotelPrefs.views}
        onToggle={() => setters.setHotelPrefsOpen(!formData.hotelPrefsOpen)}
        onRoomsChange={setters.setRooms}
        onAdultsPerRoomChange={setters.setAdultsPerRoom}
        onRoomSelectionModeChange={setters.setRoomSelectionMode}
        onRoomTypesChange={setters.setRoomTypes}
        onViewsChange={setters.setViews}
      />

      <div className="flex gap-3 pt-4 border-t">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting || !isValid}
          className="flex-1"
        >
          {isSubmitting ? "Creating..." : "Create Trip"}
        </Button>
      </div>
    </form>
  );
}
