import { Hotel } from "lucide-react";
import styles from "./hotel-photo.module.css";

export function HotelPhoto({
  src,
  alt,
}: {
  src?: string | null;
  alt: string;
}) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={styles.photo} src={src} alt={alt} />;
  }
  return (
    <span className={styles.placeholder} aria-hidden="true">
      <Hotel className={styles.placeholderIcon} />
    </span>
  );
}
