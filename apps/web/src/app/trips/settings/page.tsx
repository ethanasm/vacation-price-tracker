"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
import { api } from "../../../lib/api";

export default function SettingsPage() {
  const { user, isLoading, refreshUser } = useAuth();
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  // Middleware redirects unauthenticated users; show a shell while auth loads.
  if (isLoading || !user) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 text-muted-foreground">Loading…</div>
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

      <h1 className="mb-6 text-2xl font-semibold">Settings</h1>

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
                Get a daily digest when a tracked trip drops below your price target.
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
        </CardContent>
      </Card>
    </div>
  );
}
