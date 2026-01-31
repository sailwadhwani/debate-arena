"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { DebateArgument } from "@/lib/agents/types";

interface AgentArgumentCardProps {
  argument: DebateArgument;
  isLatest?: boolean;
  expanded?: boolean;
  onClick?: () => void;
}

export function AgentArgumentCard({
  argument,
  isLatest = false,
  expanded = false,
  onClick,
}: AgentArgumentCardProps) {
  const scoreLabels: Record<number, string> = {
    1: "Minimal",
    2: "Low",
    3: "Medium",
    4: "High",
    5: "Critical",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClick}
      className={cn(
        "relative p-4 rounded-xl border transition-all duration-200 cursor-pointer",
        isLatest
          ? "bg-white dark:bg-gray-800 border-transparent ring-2 shadow-md"
          : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
      )}
      style={{
        borderLeftWidth: "3px",
        borderLeftColor: argument.agentColor,
        ...(isLatest && { ringColor: `${argument.agentColor}50` }),
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: argument.agentColor }}
          />
          <span className="font-medium text-gray-900 dark:text-white text-sm">
            {argument.agentName}
          </span>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Round {argument.round}
          </span>
        </div>

        {argument.score !== undefined && (
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 rounded text-xs font-medium"
              style={{
                backgroundColor: `${argument.agentColor}20`,
                color: argument.agentColor,
              }}
            >
              {scoreLabels[argument.score]} ({argument.score}/5)
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <p
        className={cn(
          "text-sm text-gray-600 dark:text-gray-300 leading-relaxed",
          !expanded && "line-clamp-3"
        )}
      >
        {argument.content}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
        {argument.confidence !== undefined && (
          <div className="flex items-center gap-2">
            <span>Confidence:</span>
            <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${argument.confidence * 100}%`,
                  backgroundColor: argument.agentColor,
                }}
              />
            </div>
            <span>{(argument.confidence * 100).toFixed(0)}%</span>
          </div>
        )}

        {argument.toolsUsed && argument.toolsUsed.length > 0 && (
          <div className="flex items-center gap-1">
            <span>Tools:</span>
            {argument.toolsUsed.map((tool) => (
              <span
                key={tool}
                className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-xs"
              >
                {tool}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
