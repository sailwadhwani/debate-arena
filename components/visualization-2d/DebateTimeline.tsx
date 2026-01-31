"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronRight, MessageSquare } from "lucide-react";
import { AgentArgumentCard } from "./AgentArgumentCard";
import type { DebateRound } from "@/lib/agents/types";

interface DebateTimelineProps {
  rounds: DebateRound[];
  currentRound: number;
}

export function DebateTimeline({ rounds, currentRound }: DebateTimelineProps) {
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(
    new Set([currentRound])
  );

  const toggleRound = (roundNumber: number) => {
    setExpandedRounds((prev) => {
      const next = new Set(prev);
      if (next.has(roundNumber)) {
        next.delete(roundNumber);
      } else {
        next.add(roundNumber);
      }
      return next;
    });
  };

  if (rounds.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>Waiting for debate to start...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rounds.map((round) => {
        const isExpanded = expandedRounds.has(round.number);
        const isCurrent = round.number === currentRound;

        return (
          <div
            key={round.number}
            className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
          >
            {/* Round header */}
            <button
              onClick={() => toggleRound(round.number)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-center gap-3">
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
                <span className="font-medium text-gray-900 dark:text-white">
                  Round {round.number}
                </span>
                {isCurrent && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400 rounded-full">
                    Current
                  </span>
                )}
                {round.decision && (
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      round.decision === "conclude"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400"
                    }`}
                  >
                    {round.decision === "conclude" ? "Concluded" : "Continue"}
                  </span>
                )}
              </div>
              <span className="text-sm text-gray-500">
                {round.arguments.length} argument(s)
              </span>
            </button>

            {/* Round content */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="p-4 space-y-3">
                    {round.arguments.map((arg, i) => (
                      <AgentArgumentCard
                        key={arg.id}
                        argument={arg}
                        isLatest={isCurrent && i === round.arguments.length - 1}
                      />
                    ))}

                    {round.arguments.length === 0 && (
                      <div className="text-center py-4 text-gray-500 text-sm">
                        Waiting for arguments...
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}
