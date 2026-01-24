"use client";

import { MapPin } from "lucide-react";
import { addDays } from "date-fns";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import { DatePicker } from "../ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { TRAVELER_COUNTS } from "./constants";
import { AirportAutocomplete, type Location } from "./airport-autocomplete";
import type { TripFormErrors } from "./types";
import styles from "./trip-details-section.module.css";

export interface TripDetailsSectionProps {
  name: string;
  originAirport: string;
  destinationCode: string;
  isRoundTrip: boolean;
  departDate: Date | undefined;
  returnDate: Date | undefined;
  adults: string;
  errors: TripFormErrors;
  onNameChange: (value: string) => void;
  onOriginAirportChange: (value: string) => void;
  onDestinationCodeChange: (value: string) => void;
  onIsRoundTripChange: (value: boolean) => void;
  onDepartDateChange: (value: Date | undefined) => void;
  onReturnDateChange: (value: Date | undefined) => void;
  onAdultsChange: (value: string) => void;
  searchLocations: (query: string) => Location[];
}

export function TripDetailsSection({
  name,
  originAirport,
  destinationCode,
  isRoundTrip,
  departDate,
  returnDate,
  adults,
  errors,
  onNameChange,
  onOriginAirportChange,
  onDestinationCodeChange,
  onIsRoundTripChange,
  onDepartDateChange,
  onReturnDateChange,
  onAdultsChange,
  searchLocations,
}: TripDetailsSectionProps) {
  const today = new Date();
  const maxDate = addDays(today, 359);

  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>
          <MapPin className={styles.sectionIcon} />
          <span className={styles.sectionTitleText}>Trip Details</span>
        </div>
      </div>
      <div className={styles.sectionContent}>
        {/* Trip Name */}
        <div className={styles.field}>
          <Label className={styles.fieldLabel} htmlFor="name">
            Trip Name
          </Label>
          <Input
            id="name"
            placeholder="e.g., Summer Hawaii Vacation"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            maxLength={100}
          />
          {errors.name && (
            <span className={styles.fieldError}>{errors.name}</span>
          )}
        </div>

        {/* Airports */}
        <div className={styles.gridTwo}>
          <div className={styles.field}>
            <Label className={styles.fieldLabel} htmlFor="origin">
              From (Airport)
            </Label>
            <AirportAutocomplete
              id="origin"
              value={originAirport}
              onChange={onOriginAirportChange}
              placeholder="Search airports..."
              icon="departure"
              searchLocations={searchLocations}
            />
            {errors.originAirport && (
              <span className={styles.fieldError}>{errors.originAirport}</span>
            )}
          </div>
          <div className={styles.field}>
            <Label className={styles.fieldLabel} htmlFor="destination">
              To (Airport)
            </Label>
            <AirportAutocomplete
              id="destination"
              value={destinationCode}
              onChange={onDestinationCodeChange}
              placeholder="Search airports..."
              icon="arrival"
              searchLocations={searchLocations}
            />
            {errors.destinationCode && (
              <span className={styles.fieldError}>{errors.destinationCode}</span>
            )}
          </div>
        </div>

        {/* Dates */}
        <div className={styles.gridTwo}>
          <div className={styles.field}>
            <Label className={styles.fieldLabel}>Departure Date</Label>
            <DatePicker
              date={departDate}
              onSelect={onDepartDateChange}
              placeholder="Select departure"
              fromDate={today}
              toDate={maxDate}
            />
            {errors.departDate && (
              <span className={styles.fieldError}>{errors.departDate}</span>
            )}
          </div>
          <div className={styles.field}>
            <Label className={styles.fieldLabel}>Return Date</Label>
            <DatePicker
              date={returnDate}
              onSelect={onReturnDateChange}
              placeholder="Select return"
              fromDate={departDate || today}
              toDate={maxDate}
            />
            {errors.returnDate && (
              <span className={styles.fieldError}>{errors.returnDate}</span>
            )}
          </div>
        </div>

        {/* Travelers and Round Trip */}
        <div className={styles.gridTwo}>
          <div className={styles.field}>
            <Label className={styles.fieldLabel}>Number of Travelers</Label>
            <Select value={adults} onValueChange={onAdultsChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRAVELER_COUNTS.map((n) => (
                  <SelectItem key={n} value={n.toString()}>
                    {n} {n === 1 ? "Adult" : "Adults"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={styles.field}>
            <Label className={styles.fieldLabel}>Trip Type</Label>
            <div
              className={styles.toggleRow}
              style={{ padding: "0.5rem 0", border: "none" }}
            >
              <span className={styles.toggleTitle}>Round Trip</span>
              <Switch checked={isRoundTrip} onCheckedChange={onIsRoundTripChange} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
