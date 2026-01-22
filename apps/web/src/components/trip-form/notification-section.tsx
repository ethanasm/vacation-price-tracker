"use client";

import { Bell } from "lucide-react";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Switch } from "../ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { THRESHOLD_TYPES } from "./constants";
import type { TripFormErrors } from "./types";
import styles from "./notification-section.module.css";

export interface NotificationSectionProps {
  thresholdType: string;
  thresholdValue: string;
  emailEnabled: boolean;
  smsEnabled: boolean;
  errors: TripFormErrors;
  onThresholdTypeChange: (value: string) => void;
  onThresholdValueChange: (value: string) => void;
  onEmailEnabledChange: (value: boolean) => void;
  onSmsEnabledChange: (value: boolean) => void;
}

export function NotificationSection({
  thresholdType,
  thresholdValue,
  emailEnabled,
  smsEnabled,
  errors,
  onThresholdTypeChange,
  onThresholdValueChange,
  onEmailEnabledChange,
  onSmsEnabledChange,
}: NotificationSectionProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <div className={styles.sectionTitle}>
          <Bell className={styles.sectionIcon} />
          <span className={styles.sectionTitleText}>Price Alerts</span>
        </div>
      </div>
      <div className={styles.sectionContent}>
        <div className={styles.gridTwo}>
          <div className={styles.field}>
            <Label className={styles.fieldLabel}>Alert me when</Label>
            <Select value={thresholdType} onValueChange={onThresholdTypeChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {THRESHOLD_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className={styles.field}>
            <Label className={styles.fieldLabel}>Drops below</Label>
            <div className={styles.currencyInput}>
              <span className={styles.currencySymbol}>$</span>
              <Input
                type="number"
                placeholder="2000"
                value={thresholdValue}
                onChange={(e) => onThresholdValueChange(e.target.value)}
                min={0}
                step={0.01}
              />
            </div>
            {errors.thresholdValue && (
              <span className={styles.fieldError}>{errors.thresholdValue}</span>
            )}
          </div>
        </div>

        <div>
          <div className={styles.toggleRow}>
            <div className={styles.toggleLabel}>
              <span className={styles.toggleTitle}>Email Notifications</span>
              <span className={styles.toggleDescription}>
                Get notified via email when prices drop
              </span>
            </div>
            <Switch
              checked={emailEnabled}
              onCheckedChange={onEmailEnabledChange}
            />
          </div>
          <div className={styles.toggleRow}>
            <div className={styles.toggleLabel}>
              <span className={styles.toggleTitle}>SMS Notifications</span>
              <span className={styles.toggleDescription}>
                Get text messages for urgent price drops
              </span>
            </div>
            <Switch checked={smsEnabled} onCheckedChange={onSmsEnabledChange} />
          </div>
        </div>
      </div>
    </div>
  );
}
