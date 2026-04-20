"use client";

import { Hotel } from "lucide-react";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { CollapsibleSection } from "./collapsible-section";
import { TagInput } from "./tag-input";
import {
  ROOM_SELECTION_MODES,
  ROOM_TYPES,
  VIEW_TYPES,
  ROOM_COUNTS,
  ADULTS_PER_ROOM_COUNTS,
} from "./constants";
import styles from "./hotel-prefs-section.module.css";

export interface HotelPrefsSectionProps {
  isOpen: boolean;
  trackEnabled?: boolean;
  rooms: string;
  adultsPerRoom: string;
  city?: string;
  cityError?: string;
  roomSelectionMode: string;
  roomTypes: string[];
  views: string[];
  onToggle: () => void;
  onTrackEnabledChange?: (value: boolean) => void;
  onRoomsChange: (value: string) => void;
  onAdultsPerRoomChange: (value: string) => void;
  onCityChange?: (value: string) => void;
  onRoomSelectionModeChange: (value: string) => void;
  onRoomTypesChange: (value: string[]) => void;
  onViewsChange: (value: string[]) => void;
}

export function HotelPrefsSection({
  isOpen,
  trackEnabled = true,
  rooms,
  adultsPerRoom,
  city = "",
  cityError,
  roomSelectionMode,
  roomTypes,
  views,
  onToggle,
  onTrackEnabledChange = () => {},
  onRoomsChange,
  onAdultsPerRoomChange,
  onCityChange = () => {},
  onRoomSelectionModeChange,
  onRoomTypesChange,
  onViewsChange,
}: HotelPrefsSectionProps) {
  const disabled = !trackEnabled;
  return (
    <CollapsibleSection
      title="Hotel Preferences"
      icon={<Hotel size={20} />}
      badge={trackEnabled ? "Tracked" : "Not tracked"}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className={styles.checkboxRow}>
        <Checkbox
          id="track-hotels"
          checked={trackEnabled}
          onCheckedChange={(v) => onTrackEnabledChange(v === true)}
        />
        <Label htmlFor="track-hotels" className={styles.checkboxLabel}>
          Track Hotel Prices
        </Label>
      </div>
      <div
        className={disabled ? styles.disabledSection : undefined}
        aria-disabled={disabled}
      >
        <div className={styles.field}>
          <Label htmlFor="hotel-city" className={styles.fieldLabel}>
            City
          </Label>
          <Input
            id="hotel-city"
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            placeholder="e.g., Downtown Orlando, Waikiki"
            disabled={disabled}
            aria-invalid={Boolean(cityError)}
          />
          {cityError && <span className={styles.errorText}>{cityError}</span>}
          <span className={styles.fieldHint}>
            Used instead of the destination airport when searching for hotels.
          </span>
        </div>
        <div className={styles.gridThree}>
          <div className={styles.field}>
            <Label className={styles.fieldLabel}>Rooms</Label>
            <Select value={rooms} onValueChange={onRoomsChange} disabled={disabled}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROOM_COUNTS.map((n) => (
                  <SelectItem key={n} value={n.toString()}>
                    {n} {n === 1 ? "Room" : "Rooms"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={styles.field}>
            <Label className={styles.fieldLabel}>Adults per Room</Label>
            <Select
              value={adultsPerRoom}
              onValueChange={onAdultsPerRoomChange}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADULTS_PER_ROOM_COUNTS.map((n) => (
                  <SelectItem key={n} value={n.toString()}>
                    {n} {n === 1 ? "Adult" : "Adults"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={styles.field}>
            <Label className={styles.fieldLabel}>Room Selection</Label>
            <Select
              value={roomSelectionMode}
              onValueChange={onRoomSelectionModeChange}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROOM_SELECTION_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className={styles.field}>
          <Label className={styles.fieldLabel}>Preferred Room Types</Label>
          <TagInput
            tags={roomTypes}
            onTagsChange={onRoomTypesChange}
            placeholder="e.g., King, Suite, Studio"
            suggestions={ROOM_TYPES}
            id="room-types"
            disabled={disabled}
          />
        </div>
        <div className={styles.field}>
          <Label className={styles.fieldLabel}>Preferred Views</Label>
          <TagInput
            tags={views}
            onTagsChange={onViewsChange}
            placeholder="e.g., Ocean, City, Garden"
            suggestions={VIEW_TYPES}
            id="views"
            disabled={disabled}
          />
        </div>
      </div>
    </CollapsibleSection>
  );
}
