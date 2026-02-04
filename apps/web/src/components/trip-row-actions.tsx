"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, RefreshCw, Pencil, Trash2, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { api, ApiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TableCell } from "@/components/ui/table";

type TripStatus = "ACTIVE" | "PAUSED" | "ERROR";

interface TripActionsProps {
  tripId: string;
  tripName: string;
  tripStatus: TripStatus;
  onRefresh: () => void;
  onDeleted: () => void;
  onStatusChange: (tripId: string, newStatus: TripStatus) => void;
  onUpdatedAtChange: (tripId: string, updatedAt: string) => void;
}

const REFRESH_POLL_INTERVAL = 2000;
const REFRESH_POLL_MAX_ATTEMPTS = 30; // 60 seconds max

function useTripActions({ tripId, tripName, tripStatus, onRefresh, onDeleted, onStatusChange, onUpdatedAtChange }: TripActionsProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await api.trips.refresh(tripId);
      const refreshGroupId = response.data.refresh_group_id;
      toast.success("Refresh started");

      // Poll for completion
      let attempts = 0;
      pollRef.current = setInterval(async () => {
        attempts++;
        try {
          const statusResp = await api.trips.getRefreshStatus(refreshGroupId);
          const status = statusResp.data;
          if (
            status.status === "completed" ||
            status.status === "failed" ||
            status.completed + status.failed >= status.total ||
            attempts >= REFRESH_POLL_MAX_ATTEMPTS
          ) {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
            setIsRefreshing(false);
            onUpdatedAtChange(tripId, new Date().toISOString());
            onRefresh();
          }
        } catch {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setIsRefreshing(false);
          onRefresh();
        }
      }, REFRESH_POLL_INTERVAL);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.detail || "Failed to refresh trip");
      } else {
        toast.error("Failed to refresh trip");
      }
      setIsRefreshing(false);
    }
  }, [tripId, onRefresh, onUpdatedAtChange]);

  const handleEdit = useCallback(() => {
    router.push(`/trips/${tripId}/edit`);
  }, [router, tripId]);

  const handleDelete = useCallback(async () => {
    setIsDeleting(true);
    try {
      await api.trips.delete(tripId);
      toast.success("Trip deleted");
      onDeleted();
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.detail || "Failed to delete trip");
      } else {
        toast.error("Failed to delete trip");
      }
      setIsDeleting(false);
    }
  }, [tripId, onDeleted]);

  const handleToggleStatus = useCallback(async () => {
    const newStatus = tripStatus === "PAUSED" ? "active" : "paused";
    setIsTogglingStatus(true);
    try {
      await api.trips.updateStatus(tripId, newStatus);
      const displayStatus = newStatus.toUpperCase() as TripStatus;
      onStatusChange(tripId, displayStatus);
      toast.success(newStatus === "paused" ? "Trip paused" : "Trip resumed");
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error(err.detail || `Failed to ${newStatus === "paused" ? "pause" : "resume"} trip`);
      } else {
        toast.error(`Failed to ${newStatus === "paused" ? "pause" : "resume"} trip`);
      }
    } finally {
      setIsTogglingStatus(false);
    }
  }, [tripId, tripStatus, onStatusChange]);

  const isPaused = tripStatus === "PAUSED";

  return {
    isRefreshing,
    isDeleting,
    isTogglingStatus,
    isPaused,
    showDeleteDialog,
    setShowDeleteDialog,
    handleRefresh,
    handleEdit,
    handleDelete,
    handleToggleStatus,
  };
}

function DeleteConfirmDialog({
  tripName,
  open,
  onOpenChange,
  onConfirm,
  isDeleting,
}: {
  tripName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isDeleting: boolean;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this trip?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete &quot;{tripName}&quot; and all price
            history.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isDeleting}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Wraps a TableRow with a right-click context menu providing
 * Refresh, Edit, and Delete actions.
 */
export function TripRowContextMenu({
  tripId,
  tripName,
  tripStatus,
  onRefresh,
  onDeleted,
  onStatusChange,
  onUpdatedAtChange,
  children,
}: TripActionsProps & { children: React.ReactNode }) {
  const actions = useTripActions({ tripId, tripName, tripStatus, onRefresh, onDeleted, onStatusChange, onUpdatedAtChange });

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={actions.handleRefresh} disabled={actions.isRefreshing}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </ContextMenuItem>
          <ContextMenuItem onClick={actions.handleToggleStatus} disabled={actions.isTogglingStatus}>
            {actions.isPaused ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
            {actions.isPaused ? "Resume" : "Pause"}
          </ContextMenuItem>
          <ContextMenuItem onClick={actions.handleEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            onClick={() => actions.setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      <DeleteConfirmDialog
        tripName={tripName}
        open={actions.showDeleteDialog}
        onOpenChange={actions.setShowDeleteDialog}
        onConfirm={actions.handleDelete}
        isDeleting={actions.isDeleting}
      />
    </>
  );
}

/**
 * Kebab menu button (⋮) for a trip row, rendering a dropdown with
 * Refresh, Edit, and Delete actions.
 */
export function TripRowKebab({
  tripId,
  tripName,
  tripStatus,
  onRefresh,
  onDeleted,
  onStatusChange,
  onUpdatedAtChange,
}: TripActionsProps) {
  const actions = useTripActions({ tripId, tripName, tripStatus, onRefresh, onDeleted, onStatusChange, onUpdatedAtChange });

  return (
    <TableCell className="relative z-[5]">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            aria-label="Trip actions"
            onClick={(e) => e.stopPropagation()}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={actions.handleRefresh} disabled={actions.isRefreshing}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </DropdownMenuItem>
          <DropdownMenuItem onClick={actions.handleToggleStatus} disabled={actions.isTogglingStatus}>
            {actions.isPaused ? <Play className="mr-2 h-4 w-4" /> : <Pause className="mr-2 h-4 w-4" />}
            {actions.isPaused ? "Resume" : "Pause"}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={actions.handleEdit}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => actions.setShowDeleteDialog(true)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DeleteConfirmDialog
        tripName={tripName}
        open={actions.showDeleteDialog}
        onOpenChange={actions.setShowDeleteDialog}
        onConfirm={actions.handleDelete}
        isDeleting={actions.isDeleting}
      />
    </TableCell>
  );
}
