import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import styles from "./page.module.css";

export default function TripDetailLoading() {
  return (
    <div className={styles.containerCompact}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerRow1}>
          <Skeleton className="h-10 w-10 rounded-md" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className={styles.headerRow2}>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-8 w-8" />
        </div>
      </div>

      {/* Price Summary Bar */}
      <div className={styles.priceSummaryBar}>
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-6 w-32" />
      </div>

      {/* Main Content Grid */}
      <div className={styles.gridCompact}>
        <Card className={styles.chartCard}>
          <CardContent className={styles.chartCardContent}>
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>

        {/* Hotels */}
        <Card className={styles.listCard}>
          <CardContent className={styles.listCardContent}>
            <div className={styles.listHeader}>
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-12" />
            </div>
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Flights */}
        <Card className={styles.listCard}>
          <CardContent className={styles.listCardContent}>
            <div className={styles.listHeader}>
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-4 w-14" />
            </div>
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-md" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
