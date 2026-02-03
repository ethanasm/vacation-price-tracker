"use client";

import { useState, useCallback } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "../ui/sheet";
import { ChatTripForm, type ChatTripFormPrefilled } from "../trip-form";
import type { TripPayload } from "../trip-form";
import type { ElicitationData } from "../../lib/chat-types";

/**
 * Map of component names to their display titles.
 */
const COMPONENT_TITLES: Record<string, { title: string; description: string }> = {
  "create-trip-form": {
    title: "Complete Trip Details",
    description: "Fill in the remaining details to create your trip.",
  },
};

export interface ElicitationDrawerProps {
  /** The elicitation data from the backend, or null if no elicitation is pending */
  elicitation: ElicitationData | null;
  /** Called when the form is completed successfully */
  onComplete: (toolCallId: string, data: TripPayload) => Promise<void>;
  /** Called when the user cancels the form */
  onCancel: () => void;
}

/**
 * ElicitationDrawer renders a Sheet/Drawer with a form for collecting
 * additional user input needed by a tool call.
 *
 * When the LLM calls a tool like `create_trip` but is missing required
 * information, the backend sends an elicitation request. This component
 * opens a drawer with the appropriate form, prefilled with any data
 * already captured from the conversation.
 *
 * Currently supports:
 * - "create-trip-form": Trip creation form with TripDetailsSection,
 *   FlightPrefsSection, and HotelPrefsSection
 *
 * The drawer uses existing form components to maximize code reuse and
 * ensure feature parity with the dedicated trip creation page.
 */
export function ElicitationDrawer({
  elicitation,
  onComplete,
  onCancel,
}: ElicitationDrawerProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && !isSubmitting) {
        onCancel();
      }
    },
    [isSubmitting, onCancel]
  );

  const handleSubmit = useCallback(
    async (data: TripPayload) => {
      if (!elicitation) return;

      setIsSubmitting(true);
      try {
        await onComplete(elicitation.tool_call_id, data);
      } finally {
        setIsSubmitting(false);
      }
    },
    [elicitation, onComplete]
  );

  const handleCancel = useCallback(() => {
    if (!isSubmitting) {
      onCancel();
    }
  }, [isSubmitting, onCancel]);

  // Get the component info for this elicitation
  const componentInfo = elicitation
    ? COMPONENT_TITLES[elicitation.component] || {
        title: "Complete Details",
        description: "Fill in the required information.",
      }
    : null;

  // Render the appropriate form based on component type
  const renderForm = () => {
    if (!elicitation) return null;

    switch (elicitation.component) {
      case "create-trip-form":
        return (
          <ChatTripForm
            prefilled={elicitation.prefilled as ChatTripFormPrefilled}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isSubmitting={isSubmitting}
          />
        );
      default:
        return (
          <div className="text-center py-8 text-muted-foreground">
            Unknown form type: {elicitation.component}
          </div>
        );
    }
  };

  return (
    <Sheet open={!!elicitation} onOpenChange={handleOpenChange}>
      <SheetContent
        className="w-full sm:max-w-lg overflow-y-auto"
        side="right"
      >
        {componentInfo && (
          <SheetHeader className="mb-6">
            <SheetTitle>{componentInfo.title}</SheetTitle>
            <SheetDescription>{componentInfo.description}</SheetDescription>
          </SheetHeader>
        )}
        {renderForm()}
      </SheetContent>
    </Sheet>
  );
}
