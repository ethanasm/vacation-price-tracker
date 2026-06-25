"use client";

import { Plane } from "lucide-react";
import { Checkbox } from "../ui/checkbox";
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
import { CABIN_CLASSES, STOPS_MODES } from "./constants";
import styles from "./flight-prefs-section.module.css";

export interface FlightPrefsSectionProps {
  isOpen: boolean;
  trackEnabled?: boolean;
  cabin: string;
  stopsMode: string;
  airlines: string[];
  onToggle: () => void;
  onTrackEnabledChange?: (value: boolean) => void;
  onCabinChange: (value: string) => void;
  onStopsModeChange: (value: string) => void;
  onAirlinesChange: (value: string[]) => void;
}

export function FlightPrefsSection({
  isOpen,
  trackEnabled = true,
  cabin,
  stopsMode,
  airlines,
  onToggle,
  onTrackEnabledChange = () => {},
  onCabinChange,
  onStopsModeChange,
  onAirlinesChange,
}: FlightPrefsSectionProps) {
  const disabled = !trackEnabled;
  return (
    <CollapsibleSection
      title="Flight Preferences"
      icon={<Plane size={20} />}
      badge={trackEnabled ? "Tracked" : "Not tracked"}
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className={styles.checkboxRow}>
        <Checkbox
          id="track-flights"
          checked={trackEnabled}
          onCheckedChange={(v) => onTrackEnabledChange(v === true)}
        />
        <Label htmlFor="track-flights" className={styles.checkboxLabel}>
          Track Flight Prices
        </Label>
      </div>
      <div
        className={styles.fieldStack}
        aria-disabled={disabled}
      >
        <div className={styles.gridTwo}>
          <div className={styles.field}>
            <Label className={styles.fieldLabel}>Cabin Class</Label>
            <div className={styles.cabinChips} role="group" aria-label="Cabin Class">
              {CABIN_CLASSES.map((c) => {
                const selected = c.value === cabin;
                return (
                  <button
                    key={c.value}
                    type="button"
                    className={`${styles.cabinChip} ${selected ? styles.cabinChipSelected : ""}`}
                    aria-pressed={selected}
                    disabled={disabled}
                    onClick={() => onCabinChange(c.value)}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className={styles.field}>
            <Label className={styles.fieldLabel}>Stops</Label>
            <Select
              value={stopsMode}
              onValueChange={onStopsModeChange}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STOPS_MODES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className={styles.field}>
          <Label className={styles.fieldLabel}>Preferred Airlines</Label>
          <TagInput
            tags={airlines}
            onTagsChange={onAirlinesChange}
            placeholder="Type airline codes (e.g., UA, AA, DL)"
            id="airlines"
            disabled={disabled}
          />
          <span className={styles.fieldHint}>
            Enter 2-letter airline codes, press Enter to add
          </span>
        </div>
      </div>
    </CollapsibleSection>
  );
}
