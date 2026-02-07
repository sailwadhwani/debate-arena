"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Menu,
  X,
  Settings,
  Monitor,
  Moon,
  Sun,
  Box,
  LayoutGrid,
  Info,
  Home as HomeIcon,
  History,
} from "lucide-react";
import { useTheme, Theme } from "@/contexts/ThemeContext";

interface FloatingNavProps {
  /** Current view mode */
  view?: "2d" | "3d";
  /** Callback when view changes */
  onViewChange?: (view: "2d" | "3d") => void;
  /** Whether to show the view toggle */
  showViewToggle?: boolean;
  /** Position of the nav */
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}

export function FloatingNav({
  view = "3d",
  onViewChange,
  showViewToggle = true,
  position = "top-left",
}: FloatingNavProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { theme, setTheme, resolvedTheme } = useTheme();

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Close menu on escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  // Position classes
  const positionClasses = {
    "top-left": "top-4 left-4",
    "top-right": "top-4 right-4",
    "bottom-left": "bottom-4 left-4",
    "bottom-right": "bottom-4 right-4",
  };

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
  };

  return (
    <div
      ref={menuRef}
      className={`floating-nav ${positionClasses[position]} safe-area-top safe-area-left`}
    >
      {/* Main toggle button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="floating-nav-button"
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
      >
        {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Dropdown menu */}
      <div className={`floating-nav-menu ${isOpen ? "open" : ""}`}>
        {/* Home / Debate Arena */}
        <Link href="/debate" className="floating-nav-item" onClick={() => setIsOpen(false)}>
          <HomeIcon className="w-5 h-5" />
          <span>Debate Arena</span>
        </Link>

        {/* History */}
        <Link href="/history" className="floating-nav-item" onClick={() => setIsOpen(false)}>
          <History className="w-5 h-5" />
          <span>History</span>
        </Link>

        {/* View Toggle */}
        {showViewToggle && onViewChange && (
          <>
            <div className="floating-nav-divider" />
            <div className="px-3 py-2">
              <span className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">
                View
              </span>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => {
                    onViewChange("2d");
                    setIsOpen(false);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    view === "2d"
                      ? "bg-[var(--accent-primary-muted)] text-[var(--accent-primary)]"
                      : "text-[var(--foreground-muted)] hover:bg-[var(--glass-border)]"
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  2D
                </button>
                <button
                  onClick={() => {
                    onViewChange("3d");
                    setIsOpen(false);
                  }}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    view === "3d"
                      ? "bg-[var(--accent-primary-muted)] text-[var(--accent-primary)]"
                      : "text-[var(--foreground-muted)] hover:bg-[var(--glass-border)]"
                  }`}
                >
                  <Box className="w-4 h-4" />
                  3D
                </button>
              </div>
            </div>
          </>
        )}

        {/* Theme Toggle */}
        <div className="floating-nav-divider" />
        <div className="px-3 py-2">
          <span className="text-xs font-medium text-[var(--foreground-muted)] uppercase tracking-wider">
            Theme
          </span>
          <div className="theme-toggle-group mt-2">
            <button
              onClick={() => handleThemeChange("light")}
              className={`theme-toggle-option ${theme === "light" ? "active" : ""}`}
              aria-label="Light mode"
              title="Light mode"
            >
              <Sun className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleThemeChange("dark")}
              className={`theme-toggle-option ${theme === "dark" ? "active" : ""}`}
              aria-label="Dark mode"
              title="Dark mode"
            >
              <Moon className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleThemeChange("system")}
              className={`theme-toggle-option ${theme === "system" ? "active" : ""}`}
              aria-label="System theme"
              title="System theme"
            >
              <Monitor className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Settings Link */}
        <div className="floating-nav-divider" />
        <Link href="/configure" className="floating-nav-item" onClick={() => setIsOpen(false)}>
          <Settings className="w-5 h-5" />
          <span>Configure</span>
        </Link>

        {/* About / Info */}
        <button
          className="floating-nav-item"
          onClick={() => {
            // Could open an about modal here
            setIsOpen(false);
          }}
        >
          <Info className="w-5 h-5" />
          <span>About</span>
        </button>
      </div>
    </div>
  );
}

// Simplified theme toggle for inline use
export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div className={`theme-toggle-group ${className}`}>
      <button
        onClick={() => setTheme("light")}
        className={`theme-toggle-option ${theme === "light" ? "active" : ""}`}
        aria-label="Light mode"
      >
        <Sun className="w-4 h-4" />
      </button>
      <button
        onClick={() => setTheme("dark")}
        className={`theme-toggle-option ${theme === "dark" ? "active" : ""}`}
        aria-label="Dark mode"
      >
        <Moon className="w-4 h-4" />
      </button>
      <button
        onClick={() => setTheme("system")}
        className={`theme-toggle-option ${theme === "system" ? "active" : ""}`}
        aria-label="System theme"
      >
        <Monitor className="w-4 h-4" />
      </button>
    </div>
  );
}
