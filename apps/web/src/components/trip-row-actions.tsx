"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, RefreshCw, Pencil, Trash2 } from "lucide-react";
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

interface TripActionsProps {
  tripId: string;
  tripName: string;
  onRefresh: () => void;
  onDeleted: () => void;
}

const REFRESH_POLL_INTERVAL = 2000;
const REFRESH_POLL_MAX_ATTEMPTS = 30; // 60 seconds max

function useTripActions({ tripId, tripName, onRefresh, onDeleted }: TripActionsProps) {
  const router = useRouter();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
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
  }, [tripId, onRefresh]);

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

  return {
    isRefreshing,
    isDeleting,
    showDeleteDialog,
    setShowDeleteDialog,
    handleRefresh,
    handleEdit,
    handleDelete,
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
  onRefresh,
  onDeleted,
  children,
}: TripActionsProps & { children: React.ReactNode }) {
  const actions = useTripActions({ tripId, tripName, onRefresh, onDeleted });

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={actions.handleRefresh} disabled={actions.isRefreshing}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
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
  onRefresh,
  onDeleted,
}: TripActionsProps) {
  const actions = useTripActions({ tripId, tripName, onRefresh, onDeleted });

  return (
    <TableCell className="relative z-10">
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
