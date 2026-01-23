"use client";

import { use, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../../../components/ui/button";
import {
  TripDetailsSection,
  FlightPrefsSection,
  HotelPrefsSection,
  NotificationSection,
} from "../../../../components/trip-form";
import { useTripForm, tripDetailToFormData } from "../../../../lib/hooks/use-trip-form";
import { api, ApiError } from "../../../../lib/api";
import type { TripDetail } from "../../../../lib/api";
import type { Location } from "../../../../components/trip-form";
import styles from "./page.module.css";

export default function EditTripPage({
  params,
}: Readonly<{
  params: Promise<{ tripId: string }>;
}>) {
  const router = useRouter();
  const { tripId } = use(params);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [trip, setTrip] = useState<TripDetail | null>(null);

  // Initialize form with empty state; will be populated after loading trip
  const { formData, setters, errors, validate, getPayload } = useTripForm();

  // Load trip data on mount
  useEffect(() => {
    async function loadTrip() {
      try {
        setIsLoading(true);
        setLoadError(null);

        const response = await api.trips.getDetails(tripId);
        const tripData = response.data.trip;

        if (!tripData) {
          setLoadError("Trip not found");
          return;
        }
        setTrip(tripData);

        // Populate form with trip data
        const formInitialData = tripDetailToFormData(tripData);
        setters.setName(formInitialData.name);
        setters.setOriginAirport(formInitialData.originAirport);
        setters.setDestinationCode(formInitialData.destinationCode);
        setters.setIsRoundTrip(formInitialData.isRoundTrip);
        setters.setDepartDate(formInitialData.departDate);
        setters.setReturnDate(formInitialData.returnDate);
        setters.setAdults(formInitialData.adults);
        setters.setCabin(formInitialData.flightPrefs.cabin);
        setters.setStopsMode(formInitialData.flightPrefs.stopsMode);
        setters.setAirlines(formInitialData.flightPrefs.airlines);
        setters.setRooms(formInitialData.hotelPrefs.rooms);
        setters.setAdultsPerRoom(formInitialData.hotelPrefs.adultsPerRoom);
        setters.setRoomSelectionMode(formInitialData.hotelPrefs.roomSelectionMode);
        setters.setRoomTypes(formInitialData.hotelPrefs.roomTypes);
        setters.setViews(formInitialData.hotelPrefs.views);
        setters.setThresholdType(formInitialData.notificationPrefs.thresholdType);
        setters.setThresholdValue(formInitialData.notificationPrefs.thresholdValue);
        setters.setEmailEnabled(formInitialData.notificationPrefs.emailEnabled);
        setters.setSmsEnabled(formInitialData.notificationPrefs.smsEnabled);
        setters.setFlightPrefsOpen(formInitialData.flightPrefsOpen);
        setters.setHotelPrefsOpen(formInitialData.hotelPrefsOpen);
      } catch (error) {
        console.error("Failed to load trip:", error);
        if (error instanceof ApiError) {
          if (error.status === 404) {
            setLoadError("Trip not found");
          } else {
            setLoadError(error.detail || "Failed to load trip");
          }
        } else {
          setLoadError("Failed to load trip. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    }

    loadTrip();
  }, [tripId, setters]);

  // Memoized search function that uses the API client
  const searchLocations = useCallback(async (query: string): Promise<Location[]> => {
    return api.locations.search(query);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.error("Please fix the errors before submitting");
      return;
    }

    setIsSubmitting(true);

    const payload = getPayload();

    try {
      await api.trips.update(tripId, payload);
      toast.success("Trip updated successfully!");
      router.push(`/trips/${tripId}`);
    } catch (error) {
      console.error("Failed to update trip:", error);
      if (error instanceof ApiError) {
        if (error.status === 409) {
          toast.error("A trip with this name already exists.");
        } else if (error.status === 404) {
          toast.error("Trip not found. It may have been deleted.");
          router.push("/trips");
        } else {
          toast.error(error.detail || "Failed to update trip. Please try again.");
        }
      } else {
        toast.error("Failed to update trip. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loadingState}>
          <Loader2 className="h-8 w-8 animate-spin" />
          <p>Loading trip...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (loadError || !trip) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <h2>{loadError || "Trip not found"}</h2>
          <Button variant="outline" onClick={() => router.push("/trips")}>
            <ArrowLeft className="h-4 w-4" /> Back to trips
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => router.push(`/trips/${tripId}`)}
        >
          <ArrowLeft size={20} />
        </button>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Edit Trip</h1>
          <p className={styles.subtitle}>
            Update settings for &quot;{trip.name}&quot;
          </p>
        </div>
      </div>

      <form className={styles.form} onSubmit={handleSubmit}>
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

        <NotificationSection
          thresholdType={formData.notificationPrefs.thresholdType}
          thresholdValue={formData.notificationPrefs.thresholdValue}
          emailEnabled={formData.notificationPrefs.emailEnabled}
          smsEnabled={formData.notificationPrefs.smsEnabled}
          errors={errors}
          onThresholdTypeChange={setters.setThresholdType}
          onThresholdValueChange={setters.setThresholdValue}
          onEmailEnabledChange={setters.setEmailEnabled}
          onSmsEnabledChange={setters.setSmsEnabled}
        />

        {/* Actions */}
        <div className={styles.actions}>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push(`/trips/${tripId}`)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
