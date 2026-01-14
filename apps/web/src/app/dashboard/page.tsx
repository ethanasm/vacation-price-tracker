import { SiteFooter } from "../../components/SiteFooter";
import styles from "./page.module.css";

export default function DashboardPage() {
  return (
    <main className={styles.main}>
      <div className={styles.content}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.subtitle}>Welcome! Your trips will appear here.</p>
      </div>
      <div className={styles.footerWrap}>
        <SiteFooter />
      </div>
    </main>
  );
}
