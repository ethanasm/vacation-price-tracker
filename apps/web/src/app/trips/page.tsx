"use client";

import styles from "./page.module.css";

export default function DashboardPage() {
  return (
    <div className={styles.content}>
      <div className={styles.header}>
        <h1 className={styles.title}>Your Trips</h1>
        <button type="button">Refresh</button>
      </div>
      <p>No trips yet. Create your first trip to start tracking prices.</p>
    </div>
  );
}
