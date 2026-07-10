"use client";

import { useState } from "react";
import { airlineChip, airlineLogoUrl } from "@/lib/aurora";
import styles from "./airline-chip.module.css";

/**
 * One chip: the carrier's real logo when the code is in the logo corpus
 * (see airlineLogoUrl), falling back to the gradient monogram for unknown
 * carriers or when the image fails to load. The logo sits on a white tile
 * so colored marks stay legible in dark mode.
 */
function ChipVisual({ code, behind }: { code: string | null | undefined; behind?: boolean }) {
  // Track the URL that failed (not a boolean) so a re-render with a different
  // carrier on the same component instance retries that carrier's logo.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const logoUrl = airlineLogoUrl(code);
  const behindClass = behind ? ` ${styles.behind}` : "";

  if (logoUrl && failedUrl !== logoUrl) {
    return (
      <span className={`${styles.chip} ${styles.logoChip}${behindClass}`}>
        {/* Decorative: the airline name renders as adjacent text. */}
        <img src={logoUrl} alt="" referrerPolicy="no-referrer" onError={() => setFailedUrl(logoUrl)} />
      </span>
    );
  }
  const chip = airlineChip(code);
  return (
    <span className={`${styles.chip}${behindClass}`} style={{ backgroundImage: chip.gradient }}>
      {chip.initials}
    </span>
  );
}

export function AirlineChip({
  carrierCode,
  secondaryCode,
}: {
  carrierCode: string | null | undefined;
  secondaryCode?: string | null;
}) {
  return (
    <span className={styles.stack}>
      {secondaryCode != null && <ChipVisual code={secondaryCode} behind />}
      <ChipVisual code={carrierCode} />
    </span>
  );
}
