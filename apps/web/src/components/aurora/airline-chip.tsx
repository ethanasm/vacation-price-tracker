import { airlineChip } from "@/lib/aurora";
import styles from "./airline-chip.module.css";

export function AirlineChip({
  carrierCode,
  secondaryCode,
}: {
  carrierCode: string | null | undefined;
  secondaryCode?: string | null;
}) {
  const primary = airlineChip(carrierCode);
  return (
    <span className={styles.stack}>
      {secondaryCode != null && (
        <span
          className={`${styles.chip} ${styles.behind}`}
          style={{ backgroundImage: airlineChip(secondaryCode).gradient }}
        >
          {airlineChip(secondaryCode).initials}
        </span>
      )}
      <span className={styles.chip} style={{ backgroundImage: primary.gradient }}>
        {primary.initials}
      </span>
    </span>
  );
}
