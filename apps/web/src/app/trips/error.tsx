"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";
import { Button } from "../../components/ui/button";
import styles from "./page.module.css";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function TripsError({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log to console in development, could send to error tracking service
    console.error("Trips route error:", error);
  }, [error]);

  return (
    <div className={styles.errorState}>
      <div className={styles.errorIcon}>
        <AlertTriangle />
      </div>
      <h2 className={styles.errorTitle}>Something went wrong</h2>
      <p className={styles.errorText}>
        We couldn&apos;t load your trips. This might be a temporary issue.
      </p>
      <div className={styles.errorActions}>
        <Button variant="outline" onClick={reset}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Try again
        </Button>
        <Button asChild>
          <Link href="/">
            <Home className="h-4 w-4 mr-2" />
            Go home
          </Link>
        </Button>
      </div>
      {process.env.NODE_ENV === "development" && (
        <details className={styles.errorDetails}>
          <summary>Error details (development only)</summary>
          <pre>{error.message}</pre>
        </details>
      )}
    </div>
  );
}
