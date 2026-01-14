"use client";
import styles from "./page.module.css";
import { Separator } from "../components/ui/separator";
import { Badge, Bell, Building2, Plane } from "lucide-react";
import { SiteFooter } from "../components/SiteFooter";
import { SignInCard } from "../components/SignInCard";

const apiBase = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";
const googleStartUrl = `${apiBase}/v1/auth/google/start`;

export default function HomePage() {
  return (
    <main className={styles.main}>
      {/* Decorative gradient blobs for depth */}
      <div className={styles.backdrop} aria-hidden="true">
        <div className={styles.blob1} />
        <div className={styles.blob2} />
        <div className={styles.blob3} />
      </div>

      <section className={styles.hero}>
        <div className={styles.heroGrid}>
          {/* Left column: Text content */}
          <div className={styles.heroContent}>
            <Badge className={styles.badge}>Date-Range Optimizer</Badge>

            <h1 className={styles.title}>
              Find Your Cheapest
              <br />
              <span className={styles.titleAccent}>Vacation Window</span>
            </h1>

            <p className={styles.tagline}>
              We scan every flight and hotel combination across your flexible
              dates to find when your entire trip costs the least.
            </p>

            {/* Feature icons row */}
            <div className={styles.featuresRow}>
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>
                  <Plane size={20} />
                </div>
                <span>Flight combinations</span>
              </div>
              <Separator orientation="vertical" className={styles.separator} />
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>
                  <Building2 size={20} />
                </div>
                <span>Hotel matching</span>
              </div>
              <Separator orientation="vertical" className={styles.separator} />
              <div className={styles.featureItem}>
                <div className={styles.featureIcon}>
                  <Bell size={20} />
                </div>
                <span>Price alerts</span>
              </div>
            </div>

            {/* Stats */}
            <div className={styles.statsRow}>
              <div className={styles.stat}>
                <span className={styles.statValue}>$186</span>
                <span className={styles.statLabel}>avg. savings per trip</span>
              </div>
              <div className={styles.stat}>
                <span className={styles.statValue}>90+</span>
                <span className={styles.statLabel}>
                  date combinations checked
                </span>
              </div>
            </div>
          </div>

          {/* Right column: Sign-in card */}
          <div className={styles.heroCard}>
            <SignInCard
              signInUrl={googleStartUrl}
              onSignIn={() => globalThis.location.assign(googleStartUrl)}
            />
          </div>
        </div>
      </section>

      <div className={styles.footerWrap}>
        <SiteFooter />
      </div>
    </main>
  );
}
