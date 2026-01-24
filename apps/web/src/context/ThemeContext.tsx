"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";

// Use useLayoutEffect on client, useEffect on server (SSR safety)
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

type ThemeMode = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  theme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const STORAGE_KEY = "theme-mode";

/**
 * Determines if the current time falls within dark mode hours.
 * Dark mode is active from 6pm (18:00) to 8am (08:00) local time.
 */
function isDarkModeTime(): boolean {
  const hour = new Date().getHours();
  return hour >= 18 || hour < 8;
}

function getResolvedTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") {
    return isDarkModeTime() ? "dark" : "light";
  }
  return mode;
}

function applyTheme(theme: ResolvedTheme) {
  if (theme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [theme, setTheme] = useState<ResolvedTheme>("light");

  // Load saved mode from localStorage
  useIsomorphicLayoutEffect(() => {
    const savedMode = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    const initialMode = savedMode || "system";
    setModeState(initialMode);

    const resolved = getResolvedTheme(initialMode);
    setTheme(resolved);
    applyTheme(resolved);
  }, []);

  // Update theme when mode changes or time changes (for system mode)
  useEffect(() => {
    const resolved = getResolvedTheme(mode);
    setTheme(resolved);
    applyTheme(resolved);

    // Only set up interval for system mode
    if (mode === "system") {
      const interval = setInterval(() => {
        const newResolved = getResolvedTheme("system");
        setTheme(newResolved);
        applyTheme(newResolved);
      }, 60_000);

      return () => clearInterval(interval);
    }
  }, [mode]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem(STORAGE_KEY, newMode);

    const resolved = getResolvedTheme(newMode);
    setTheme(resolved);
    applyTheme(resolved);
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, theme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
