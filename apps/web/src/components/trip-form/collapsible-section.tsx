"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./collapsible-section.module.css";

export interface CollapsibleSectionProps {
  title: string;
  icon: ReactNode;
  badge?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  icon,
  badge,
  isOpen,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <div className={styles.section}>
      <div
        className={styles.sectionHeader}
        onClick={onToggle}
        onKeyDown={(e) => e.key === "Enter" && onToggle()}
        tabIndex={0}
        role="button"
        aria-expanded={isOpen}
      >
        <div className={styles.sectionTitle}>
          <span className={styles.sectionIcon}>{icon}</span>
          <span className={styles.sectionTitleText}>{title}</span>
          {badge && <span className={styles.sectionBadge}>{badge}</span>}
        </div>
        <ChevronDown
          className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ""}`}
        />
      </div>
      <div
        className={`${styles.sectionContent} ${!isOpen ? styles.sectionCollapsed : ""}`}
      >
        {children}
      </div>
    </div>
  );
}
