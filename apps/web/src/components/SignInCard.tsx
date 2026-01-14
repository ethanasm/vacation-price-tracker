"use client";

import GoogleButton from "react-google-button";

import styles from "./SignInCard.module.css";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./ui/card";

type SignInCardProps = Readonly<{
  onSignIn: () => void;
  signInUrl: string;
}>;

export function SignInCard({ onSignIn }: SignInCardProps) {
  return (
    <Card className={styles.card}>
      <CardHeader className={styles.header}>
        <CardTitle className={styles.title}>
          Sign in to start tracking
        </CardTitle>
        <CardDescription className={styles.description}>
          Google OAuth only. We never store passwords.
        </CardDescription>
      </CardHeader>
      <CardContent className={styles.content}>
        <GoogleButton onClick={onSignIn} />
        <p className={styles.helper}>
          Scan thousands of flight and hotel combinations to find your cheapest
          vacation window.
        </p>
      </CardContent>
    </Card>
  );
}
