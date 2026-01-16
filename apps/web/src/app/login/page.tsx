"use client";

import GoogleButton from "react-google-button";
import { redirectTo } from "../../lib/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import styles from "./page.module.css";

const apiBase =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "https://localhost:8000";
const googleStartUrl = `${apiBase}/v1/auth/google/start`;

export default function LoginPage() {
  const handleSignIn = () => redirectTo(googleStartUrl);

  return (
    <main className={styles.main}>
      <Card className={styles.card}>
        <CardHeader className={styles.header}>
          <CardTitle className={styles.title}>Sign in to start tracking</CardTitle>
          <CardDescription className={styles.description}>
            Google OAuth only. We never store passwords.
          </CardDescription>
        </CardHeader>
        <CardContent className={styles.content}>
          <GoogleButton onClick={handleSignIn} />
          <p className={styles.helper}>
            Scan thousands of flight and hotel combinations to find your cheapest
            vacation window.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
