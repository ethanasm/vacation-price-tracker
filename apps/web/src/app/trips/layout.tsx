"use client";

import { useRouter } from "next/navigation";
import { Plane, LogOut } from "lucide-react";
import { Button } from "../../components/ui/button";
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

  // Middleware handles redirecting unauthenticated users to home page
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
            <>
              <div className={styles.userCard}>
                <div className={styles.avatar}>{getInitials(user.email)}</div>
                <div className={styles.userDetails}>
                  <span className={styles.greeting}>{getGreeting()},</span>
                  <span className={styles.userName}>{getDisplayName(user.email)}</span>
                </div>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={handleSignOut} title="Sign out">
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
      {children}
    </main>
  );
}
