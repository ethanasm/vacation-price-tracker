import { Skeleton } from "../../components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table";
import styles from "./page.module.css";

export default function TripsLoading() {
  return (
    <>
      {/* Page header skeleton */}
      <div className={styles.pageHeader}>
        <Skeleton className="h-8 w-36" />
        <div className={styles.headerActions}>
          <Skeleton className="h-9 w-28 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>

      {/* Two-column layout */}
      <div className={styles.columns}>
        {/* Table panel */}
        <div className={styles.tablePanel}>
          <div className={styles.tableWrapper}>
            <Table className={styles.tripTable}>
              <TableHeader>
                <TableRow>
                  <TableHead>Trip Name</TableHead>
                  <TableHead>Route</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead className="text-right">Flight</TableHead>
                  <TableHead className="text-right">Hotel</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-10">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3].map((i) => (
                  <TableRow key={i} className={styles.skeletonRow}>
                    <TableCell>
                      <Skeleton className="h-4 w-32" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-12" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-8 w-8 rounded" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Chat panel skeleton */}
        <div className={styles.chatPanel}>
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-5 w-24 mt-4" />
          <Skeleton className="h-4 w-48 mt-2" />
        </div>
      </div>
    </>
  );
}
