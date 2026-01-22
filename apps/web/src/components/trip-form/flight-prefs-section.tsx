"use client";

import { Plane } from "lucide-react";
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
  cabin: string;
  stopsMode: string;
  airlines: string[];
  onToggle: () => void;
  onCabinChange: (value: string) => void;
  onStopsModeChange: (value: string) => void;
  onAirlinesChange: (value: string[]) => void;
}

export function FlightPrefsSection({
  isOpen,
  cabin,
  stopsMode,
  airlines,
  onToggle,
  onCabinChange,
  onStopsModeChange,
  onAirlinesChange,
}: FlightPrefsSectionProps) {
  return (
    <CollapsibleSection
      title="Flight Preferences"
      icon={<Plane size={20} />}
      badge="Optional"
      isOpen={isOpen}
      onToggle={onToggle}
    >
      <div className={styles.gridTwo}>
        <div className={styles.field}>
          <Label className={styles.fieldLabel}>Cabin Class</Label>
          <Select value={cabin} onValueChange={onCabinChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CABIN_CLASSES.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className={styles.field}>
          <Label className={styles.fieldLabel}>Stops</Label>
          <Select value={stopsMode} onValueChange={onStopsModeChange}>
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
        />
        <span className={styles.fieldHint}>
          Enter 2-letter airline codes, press Enter to add
        </span>
      </div>
    </CollapsibleSection>
  );
}
