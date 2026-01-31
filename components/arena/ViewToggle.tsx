"use client";

import { Monitor, Box } from "lucide-react";
import { cn } from "@/lib/utils";

interface ViewToggleProps {
  view: "2d" | "3d";
  onChange: (view: "2d" | "3d") => void;
}

export function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
      <button
        onClick={() => onChange("2d")}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
          view === "2d"
            ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
            : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        )}
      >
        <Monitor className="w-4 h-4" />
        2D
      </button>
      <button
        onClick={() => onChange("3d")}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all",
          view === "3d"
            ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white"
            : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
        )}
      >
        <Box className="w-4 h-4" />
        3D
      </button>
    </div>
  );
}
