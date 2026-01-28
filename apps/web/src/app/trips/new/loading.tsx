import { Skeleton } from "@/components/ui/skeleton";
import styles from "./page.module.css";

export default function NewTripLoading() {
  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div className={styles.headerContent}>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64 mt-1" />
        </div>
      </div>

      {/* Form sections skeleton */}
      <div className="flex flex-col gap-6">
        {/* Trip details section */}
        <div className="rounded-lg border p-6 space-y-4">
          <Skeleton className="h-5 w-28" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>

        {/* Preferences section */}
        <div className="rounded-lg border p-6 space-y-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Skeleton className="h-10 w-20" />
          <Skeleton className="h-10 w-28" />
        </div>
      </div>
    </div>
  );
}
