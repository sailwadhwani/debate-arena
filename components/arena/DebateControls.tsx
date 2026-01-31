"use client";

import { Play, Square, RotateCcw, Pause } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { DebateStatus } from "@/lib/agents/types";

interface DebateControlsProps {
  status: DebateStatus;
  onStart: () => void;
  onStop?: () => void;
  onPause?: () => void;
  onResume?: () => void;
  onReset: () => void;
  disabled?: boolean;
}

export function DebateControls({
  status,
  onStart,
  onStop,
  onPause,
  onResume,
  onReset,
  disabled,
}: DebateControlsProps) {
  const isRunning = status === "debating" || status === "loading" || status === "concluding";
  const isPaused = status === "paused";
  const isComplete = status === "complete" || status === "error";

  return (
    <div className="flex items-center gap-3">
      {!isRunning && !isPaused && !isComplete && (
        <Button
          onClick={onStart}
          disabled={disabled}
          className="flex-1"
        >
          <Play className="w-4 h-4 mr-2" />
          Start Debate
        </Button>
      )}

      {status === "debating" && onPause && (
        <Button
          variant="outline"
          onClick={onPause}
          className="flex-1"
        >
          <Pause className="w-4 h-4 mr-2" />
          Pause
        </Button>
      )}

      {isPaused && onResume && (
        <Button
          onClick={onResume}
          className="flex-1"
        >
          <Play className="w-4 h-4 mr-2" />
          Resume
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

      {(isComplete || isPaused || isRunning) && (
        <Button
          variant="outline"
          onClick={onReset}
        >
          <RotateCcw className="w-4 h-4 mr-2" />
          {isComplete ? "Reset" : "End"}
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
              : status === "paused"
              ? "bg-amber-500"
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
