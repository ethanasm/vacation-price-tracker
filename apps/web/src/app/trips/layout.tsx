"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plane, LogOut, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../../components/ui/dropdown-menu";
import { ThemeToggle } from "../../components/ui/theme-toggle";
import { useAuth } from "../../context/AuthContext";
import styles from "./page.module.css";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getInitials(email: string): string {
  const name = email.split("@")[0];
  // Handle common email patterns like first.last or firstlast
  const parts = name.split(/[._-]/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function getDisplayName(email: string): string {
  const name = email.split("@")[0];
  // Convert first.last or first_last to "First Last"
  return name
    .split(/[._-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, isLoading, logout } = useAuth();
  const router = useRouter();

  const handleSignOut = async () => {
    await logout();
    router.push("/");
  };

  // Middleware redirects visitors with no live session, but it only inspects
  // the cookies — a refresh token the server has revoked (rotated elsewhere,
  // Redis lost the session) still looks valid to it. When auth then resolves
  // to signed-out here, clear the dead cookies and return to the landing page
  // instead of rendering a broken shell. The ?signedout=1 marker tells the
  // middleware not to redirect back to /trips if logout() failed to clear the
  // httpOnly cookies (API unreachable) — without it this would loop.
  useEffect(() => {
    if (isLoading || user) {
      return;
    }
    void logout()
      .catch(() => {
        // Best effort — the cookies may already be gone.
      })
      .finally(() => router.replace("/?signedout=1"));
  }, [isLoading, user, logout, router]);

  // Show header shell while auth is loading - loading.tsx handles the content area
  return (
    <main className={styles.main}>
      {/* Header bar */}
      <div className={styles.header}>
        {/* Brand */}
        <div className={styles.brandSection}>
          <div className={styles.brandIcon}>
            <Plane />
          </div>
          <span className={styles.brandName}>Price Tracker</span>
        </div>

        {/* User section - show skeleton while loading */}
        <div className={styles.userSection}>
          <ThemeToggle />
          {isLoading || !user ? (
            <div className={styles.userCard}>
              <div className={styles.avatar}>--</div>
            </div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className={styles.userCard} title="Account menu">
                  <div className={styles.avatar}>{getInitials(user.email)}</div>
                  <div className={styles.userDetails}>
                    <span className={styles.greeting}>{getGreeting()},</span>
                    <span className={styles.userName}>{getDisplayName(user.email)}</span>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push("/trips/settings")}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
      {children}
    </main>
  );
}
