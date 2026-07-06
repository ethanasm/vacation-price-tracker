"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card";
import { Switch } from "../../../components/ui/switch";
import { Label } from "../../../components/ui/label";
import { Button } from "../../../components/ui/button";
import { useAuth } from "../../../context/AuthContext";
import { api, type FeatureFlagItem } from "../../../lib/api";

/** Humanize a snake_case flag name for display ("kiwi_flights" → "Kiwi flights"). */
function flagLabel(name: string): string {
  const spaced = name.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function AdminFlagsCard() {
  const [flags, setFlags] = useState<FeatureFlagItem[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [savingFlag, setSavingFlag] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.featureFlags
      .list()
      .then((response) => {
        if (!cancelled) setFlags(response.flags);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggle = async (name: string, next: boolean) => {
    setSavingFlag(name);
    try {
      const updated = await api.featureFlags.set(name, next);
      setFlags((current) =>
        (current ?? []).map((flag) => (flag.name === name ? updated : flag)),
      );
      toast.success(`${flagLabel(name)} ${next ? "enabled" : "disabled"}`);
    } catch {
      toast.error("Failed to update flag", {
        description: "Please try again.",
      });
    } finally {
      setSavingFlag(null);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" aria-hidden />
          Admin
        </CardTitle>
        <CardDescription>
          Operator feature flags — these change behavior for every user,
          instantly.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loadFailed ? (
          <p className="text-sm text-muted-foreground">
            Failed to load feature flags.
          </p>
        ) : flags === null ? (
          <p className="text-sm text-muted-foreground">Loading flags…</p>
        ) : (
          flags.map((flag, index) => (
            <div
              key={flag.name}
              className={
                index === 0
                  ? "flex items-center justify-between gap-4"
                  : "mt-4 flex items-center justify-between gap-4 border-t border-[var(--aurora-hairline)] pt-4"
              }
            >
              <div className="space-y-0.5">
                <Label htmlFor={`flag-${flag.name}`}>
                  {flagLabel(flag.name)}
                </Label>
                <p className="text-sm text-muted-foreground">
                  {flag.description}
                </p>
              </div>
              <Switch
                id={`flag-${flag.name}`}
                checked={flag.enabled}
                disabled={savingFlag !== null}
                onCheckedChange={(next) => handleToggle(flag.name, next)}
                aria-label={`${flagLabel(flag.name)} flag`}
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

export default function SettingsPage() {
  const { user, isLoading, refreshUser } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Middleware redirects unauthenticated users; show a shell while auth loads.
  if (isLoading || !user) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-8 text-muted-foreground">
          Loading…
        </div>
      </div>
    );
  }

  const handleToggleEmail = async (next: boolean) => {
    setSaving(true);
    try {
      await api.users.updatePreferences(next);
      await refreshUser();
      toast.success(
        next ? "Email notifications enabled" : "Email notifications disabled",
        {
          description: next
            ? "You'll receive price-drop alerts via email."
            : "You won't receive price-drop emails.",
        },
      );
    } catch {
      toast.error("Failed to update settings", {
        description: "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    // The app body is height:100vh + overflow:hidden (Aurora canvas), so every
    // route must scroll internally — without this wrapper the page clips at
    // the viewport and content below the fold (e.g. the Admin card's last
    // rows) is unreachable.
    <div
      data-testid="settings-scroll-region"
      className="min-h-0 flex-1 overflow-y-auto"
    >
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Button
          variant="ghost"
          size="sm"
          className="mb-4"
          onClick={() => router.push("/trips")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>

        <h1 className="mb-6 text-2xl font-extrabold">Settings</h1>

        <Card>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>
              Manage how you hear about price changes on your tracked trips.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <Label htmlFor="email-notifications">Email notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Get a daily digest when a tracked trip drops below your price
                  target.
                </p>
              </div>
              <Switch
                id="email-notifications"
                checked={user.email_notifications_enabled}
                disabled={saving}
                onCheckedChange={handleToggleEmail}
                aria-label="Email notifications"
              />
            </div>
            <div className="mt-4 flex items-center justify-between gap-4 border-t border-[var(--aurora-hairline)] pt-4">
              <div className="space-y-0.5">
                <Label htmlFor="sms-notifications">SMS alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Instant text on a major price drop.
                </p>
              </div>
              <Switch
                id="sms-notifications"
                checked={false}
                disabled
                aria-label="SMS alerts"
              />
            </div>
          </CardContent>
        </Card>

        {user.is_admin && <AdminFlagsCard />}
      </div>
    </div>
  );
}
