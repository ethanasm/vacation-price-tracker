import styles from "./SiteFooter.module.css";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <span>Track flight and hotel prices without the spreadsheet sprawl.</span>
      <span className={styles.divider} aria-hidden="true">
        ·
      </span>
      <span>
        (c) {year} Ethan Smith
      </span>
    </footer>
  );
}
