"use client";

import { Play, Square, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { DebateStatus } from "@/lib/agents/types";

interface DebateControlsProps {
  status: DebateStatus;
  onStart: () => void;
  onStop?: () => void;
  onReset: () => void;
  disabled?: boolean;
}

export function DebateControls({
  status,
  onStart,
  onStop,
  onReset,
  disabled,
}: DebateControlsProps) {
  const isRunning = status === "debating" || status === "loading" || status === "concluding";
  const isComplete = status === "complete" || status === "error";

  return (
    <div className="flex items-center gap-3">
      {!isRunning && !isComplete && (
        <Button
          onClick={onStart}
          disabled={disabled}
          className="flex-1"
        >
          <Play className="w-4 h-4 mr-2" />
          Start Debate
        </Button>
      )}

      {isRunning && onStop && (
        <Button
          variant="danger"
          onClick={onStop}
          className="flex-1"
        >
          <Square className="w-4 h-4 mr-2" />
          Stop
        </Button>
      )}

      {(isComplete || status === "idle") && (
        <Button
          variant="outline"
          onClick={onReset}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          Reset
        </Button>
      )}

      {/* Status indicator */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <div
          className={`w-2 h-2 rounded-full ${
            status === "debating" || status === "concluding"
              ? "bg-green-500 animate-pulse"
              : status === "loading"
              ? "bg-amber-500 animate-pulse"
              : status === "complete"
              ? "bg-blue-500"
              : status === "error"
              ? "bg-red-500"
              : "bg-gray-400"
          }`}
        />
        <span className="capitalize">{status}</span>
      </div>
    </div>
  );
}
