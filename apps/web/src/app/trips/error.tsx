"use client";

import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LogIn, RefreshCw, Home } from "lucide-react";
import Link from "next/link";
import { Button } from "../../components/ui/button";
import styles from "./page.module.css";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Check if an error is authentication-related
 */
function isAuthError(error: Error): boolean {
  const message = error.message.toLowerCase();
  const authKeywords = [
    "auth",
    "401",
    "unauthorized",
    "session expired",
    "sign in",
    "login",
    "authentication",
  ];
  return (
    error.name === "AuthError" ||
    error.name === "ChatAuthError" ||
    authKeywords.some((keyword) => message.includes(keyword))
  );
}

export default function TripsError({ error, reset }: ErrorPageProps) {
  const router = useRouter();
  const isAuth = useMemo(() => isAuthError(error), [error]);

  useEffect(() => {
    // Log to console in development, could send to error tracking service
    console.error("Trips route error:", error);
  }, [error]);

  // For auth errors, redirect to home page after a short delay
  useEffect(() => {
    if (isAuth) {
      const timer = setTimeout(() => {
        router.push("/");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isAuth, router]);

  if (isAuth) {
    return (
      <div className={styles.errorState}>
        <div className={styles.errorIcon}>
          <LogIn />
        </div>
        <h2 className={styles.errorTitle}>Session Expired</h2>
        <p className={styles.errorText}>
          Your session has expired. Please sign in again to continue.
          Redirecting to home page...
        </p>
        <div className={styles.errorActions}>
          <Button asChild>
            <Link href="/">
              <LogIn className="h-4 w-4 mr-2" />
              Sign in
            </Link>
          </Button>
        </div>
      </div>
    );
  }

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
