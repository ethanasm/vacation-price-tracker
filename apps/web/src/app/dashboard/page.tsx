"use client";

import { useRouter } from "next/navigation";
import { SiteFooter } from "../../components/SiteFooter";
import { Button } from "../../components/ui/button";
import { useAuth } from "../../context/AuthContext";
import styles from "./page.module.css";

export default function DashboardPage() {
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

  return (
    <main className={styles.main}>
      <div className={styles.header}>
        <Button variant="outline" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
      <div className={styles.content}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.subtitle}>
          Welcome{user?.email ? `, ${user.email}` : ""}! Your trips will appear
          here.
        </p>
      </div>
      <div className={styles.footerWrap}>
        <SiteFooter />
      </div>
    </main>
  );
}
