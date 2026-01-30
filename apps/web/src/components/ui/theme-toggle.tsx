"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { useTheme } from "../../context/ThemeContext";

export function ThemeToggle() {
  const { mode, setMode } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Render a placeholder with the same dimensions during SSR
  if (!mounted) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        className="relative"
        title="Toggle theme"
        disabled
      >
        <Sun className="h-4 w-4" />
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          title="Toggle theme"
        >
          <Sun
            className={`h-4 w-4 transition-all ${
              mode === "light" ? "rotate-0 scale-100" : "rotate-90 scale-0 absolute"
            }`}
          />
          <Moon
            className={`h-4 w-4 transition-all ${
              mode === "dark" ? "rotate-0 scale-100" : "-rotate-90 scale-0 absolute"
            }`}
          />
          <Monitor
            className={`h-4 w-4 transition-all ${
              mode === "system" ? "rotate-0 scale-100" : "rotate-90 scale-0 absolute"
            }`}
          />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => setMode("light")}
          className={mode === "light" ? "bg-accent/50" : ""}
        >
          <Sun className="mr-2 h-4 w-4" />
          <span>Light</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setMode("dark")}
          className={mode === "dark" ? "bg-accent/50" : ""}
        >
          <Moon className="mr-2 h-4 w-4" />
          <span>Dark</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => setMode("system")}
          className={mode === "system" ? "bg-accent/50" : ""}
        >
          <Monitor className="mr-2 h-4 w-4" />
          <span>Auto</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
