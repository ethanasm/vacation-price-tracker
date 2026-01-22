"use client";

import { Hotel } from "lucide-react";
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
  rooms: string;
  adultsPerRoom: string;
  roomSelectionMode: string;
  roomTypes: string[];
  views: string[];
  onToggle: () => void;
  onRoomsChange: (value: string) => void;
  onAdultsPerRoomChange: (value: string) => void;
  onRoomSelectionModeChange: (value: string) => void;
  onRoomTypesChange: (value: string[]) => void;
  onViewsChange: (value: string[]) => void;
}

export function HotelPrefsSection({
  isOpen,
  rooms,
  adultsPerRoom,
  roomSelectionMode,
  roomTypes,
  views,
  onToggle,
  onRoomsChange,
  onAdultsPerRoomChange,
  onRoomSelectionModeChange,
  onRoomTypesChange,
  onViewsChange,
}: HotelPrefsSectionProps) {
  return (
    <CollapsibleSection
      title="Hotel Preferences"
      icon={<Hotel size={20} />}
      badge="Optional"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className={styles.gridThree}>
        <div className={styles.field}>
          <Label className={styles.fieldLabel}>Rooms</Label>
          <Select value={rooms} onValueChange={onRoomsChange}>
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
          <Select value={adultsPerRoom} onValueChange={onAdultsPerRoomChange}>
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
        />
      </div>
    </CollapsibleSection>
  );
}
