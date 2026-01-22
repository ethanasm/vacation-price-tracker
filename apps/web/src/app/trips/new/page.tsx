"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../../components/ui/button";
import {
  TripDetailsSection,
  FlightPrefsSection,
  HotelPrefsSection,
  NotificationSection,
} from "../../../components/trip-form";
import { useTripForm } from "../../../lib/hooks/use-trip-form";
import styles from "./page.module.css";

export default function CreateTripPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { formData, setters, errors, validate, getPayload } = useTripForm();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      toast.error("Please fix the errors before submitting");
      return;
    }

    setIsSubmitting(true);

    const payload = getPayload();

    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/v1/trips', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(payload),
      // });

      console.log("Creating trip with payload:", payload);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast.success("Trip created successfully!");
      router.push("/trips");
    } catch (error) {
      console.error("Failed to create trip:", error);
      toast.error("Failed to create trip. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <button
          type="button"
          className={styles.backButton}
          onClick={() => router.back()}
        >
          <ArrowLeft size={20} />
        </button>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Create New Trip</h1>
          <p className={styles.subtitle}>
            Set up price tracking for your vacation
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
            onClick={() => router.back()}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Create Trip"}
          </Button>
        </div>
      </form>
    </div>
  );
}
