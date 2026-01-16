"use client";

import { useRouter } from "next/navigation";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../context/AuthContext";
import styles from "./page.module.css";

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

  if (isLoading) {
    return (
      <main className={styles.main}>
        <div className={styles.content}>
          <p className={styles.subtitle}>Loading...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <p>Welcome, {user.email}</p>
        <Button variant="outline" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
      {children}
    </main>
  );
}

