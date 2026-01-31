"use client";

import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Expand } from "lucide-react";
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
        "relative p-4 rounded-xl border transition-all duration-200 group",
        onClick && "cursor-pointer hover:shadow-lg",
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
      {/* Expand hint */}
      {onClick && !expanded && (
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="p-1.5 rounded-lg bg-gray-100 dark:bg-gray-700">
            <Expand className="w-3.5 h-3.5 text-gray-500" />
          </div>
        </div>
      )}

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

      {/* Content - Markdown rendered */}
      <div
        className={cn(
          "prose prose-sm dark:prose-invert max-w-none",
          "prose-headings:text-gray-900 dark:prose-headings:text-white",
          "prose-p:text-gray-600 dark:prose-p:text-gray-300",
          "prose-strong:text-gray-900 dark:prose-strong:text-white",
          "prose-em:text-gray-700 dark:prose-em:text-gray-200",
          "prose-ul:text-gray-600 dark:prose-ul:text-gray-300",
          "prose-ol:text-gray-600 dark:prose-ol:text-gray-300",
          "prose-li:marker:text-gray-400",
          !expanded && "line-clamp-4"
        )}
      >
        <ReactMarkdown>{argument.content}</ReactMarkdown>
      </div>

      {/* Click to expand hint */}
      {!expanded && onClick && (
        <div className="mt-2 text-xs text-gray-400 dark:text-gray-500 group-hover:text-gray-500 dark:group-hover:text-gray-400 transition-colors">
          Click to read full argument
        </div>
      )}

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

/**
 * Full expanded view for modal display
 */
export function ArgumentFullView({ argument }: { argument: DebateArgument }) {
  const scoreLabels: Record<number, string> = {
    1: "Minimal",
    2: "Low",
    3: "Medium",
    4: "High",
    5: "Critical",
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div
        className="flex items-center gap-4 pb-4 mb-6 border-b border-gray-200 dark:border-gray-700"
        style={{ borderBottomColor: `${argument.agentColor}30` }}
      >
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
          style={{ backgroundColor: argument.agentColor }}
        >
          {argument.agentName.charAt(0)}
        </div>
        <div className="flex-1">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            {argument.agentName}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Round {argument.round} &middot;{" "}
            {new Date(argument.timestamp).toLocaleTimeString()}
          </p>
        </div>
        {argument.score !== undefined && (
          <div className="text-right">
            <div
              className="px-3 py-1.5 rounded-lg text-sm font-semibold"
              style={{
                backgroundColor: `${argument.agentColor}20`,
                color: argument.agentColor,
              }}
            >
              {scoreLabels[argument.score]} ({argument.score}/5)
            </div>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="prose prose-lg dark:prose-invert max-w-none prose-headings:text-gray-900 dark:prose-headings:text-white prose-p:text-gray-700 dark:prose-p:text-gray-300 prose-strong:text-gray-900 dark:prose-strong:text-white prose-em:text-gray-700 dark:prose-em:text-gray-200 prose-ul:text-gray-700 dark:prose-ul:text-gray-300 prose-ol:text-gray-700 dark:prose-ol:text-gray-300 prose-li:marker:text-gray-400 prose-blockquote:border-l-4 prose-blockquote:border-gray-300 dark:prose-blockquote:border-gray-600 prose-blockquote:pl-4 prose-blockquote:text-gray-600 dark:prose-blockquote:text-gray-400">
        <ReactMarkdown>{argument.content}</ReactMarkdown>
      </div>

      {/* Footer stats */}
      <div className="mt-8 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
        {argument.confidence !== undefined && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Confidence:
            </span>
            <div className="w-32 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${argument.confidence * 100}%`,
                  backgroundColor: argument.agentColor,
                }}
              />
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {(argument.confidence * 100).toFixed(0)}%
            </span>
          </div>
        )}

        {argument.toolsUsed && argument.toolsUsed.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Tools used:
            </span>
            {argument.toolsUsed.map((tool) => (
              <span
                key={tool}
                className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {tool}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
