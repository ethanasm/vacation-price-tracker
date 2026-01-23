"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Plane, Loader2, MapPin } from "lucide-react";
import { Input } from "../ui/input";
import type { LocationResult } from "../../lib/api";
import styles from "./airport-autocomplete.module.css";

// Re-export LocationResult as Location for backward compatibility
export type Location = LocationResult;

export interface AirportAutocompleteProps {
  id: string;
  value: string;
  onChange: (value: string) => void;
  onSelect?: (location: Location) => void;
  placeholder?: string;
  icon?: "departure" | "arrival";
  searchLocations: (query: string) => Promise<Location[]>;
  disabled?: boolean;
}

export function AirportAutocomplete({
  id,
  value,
  onChange,
  onSelect,
  placeholder = "Search airports...",
  icon = "departure",
  searchLocations,
  disabled = false,
}: AirportAutocompleteProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<Location[]>([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Search with debounce
  const search = useCallback(
    async (query: string) => {
      if (query.length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      try {
        const locations = await searchLocations(query);
        setResults(locations);
        setIsOpen(locations.length > 0);
        setHighlightedIndex(-1);
      } catch {
        setResults([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    },
    [searchLocations]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.toUpperCase();
    onChange(newValue);

    // Debounce search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => {
      search(newValue);
    }, 300);
  };

  const handleSelect = (location: Location) => {
    onChange(location.code);
    onSelect?.(location);
    setIsOpen(false);
    setResults([]);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < results.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < results.length) {
          handleSelect(results[highlightedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        break;
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.inputWrapper}>
        <Plane
          className={styles.inputIcon}
          style={icon === "arrival" ? { transform: "rotate(90deg)" } : undefined}
        />
        <Input
          ref={inputRef}
          id={id}
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => value.length >= 2 && results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          maxLength={3}
          disabled={disabled}
          className={styles.input}
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className={styles.loadingIcon} />
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className={styles.dropdown}>
          {results.map((location, index) => (
            <button
              key={`${location.code}-${location.type}`}
              type="button"
              className={`${styles.option} ${
                index === highlightedIndex ? styles.optionHighlighted : ""
              }`}
              onClick={() => handleSelect(location)}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              <div className={styles.optionIcon}>
                {location.type === "AIRPORT" ? (
                  <Plane size={16} />
                ) : (
                  <MapPin size={16} />
                )}
              </div>
              <div className={styles.optionContent}>
                <div className={styles.optionMain}>
                  <span className={styles.optionCode}>{location.code}</span>
                  <span className={styles.optionName}>{location.name}</span>
                </div>
                <div className={styles.optionSub}>
                  {location.city}, {location.country}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
