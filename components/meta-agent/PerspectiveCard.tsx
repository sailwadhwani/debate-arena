"use client";

import { motion } from "framer-motion";
import {
  Shield,
  Briefcase,
  Package,
  Cpu,
  User,
  Bot,
  ChevronDown,
  ChevronRight,
  Check,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { SuggestedPerspective } from "@/lib/meta-agent";
import type { AvatarType } from "@/lib/agents/types";

interface PerspectiveCardProps {
  perspective: SuggestedPerspective;
  selected?: boolean;
  compact?: boolean;
  onClick?: () => void;
  onSelect?: (selected: boolean) => void;
}

const avatarIcons: Record<AvatarType, React.ComponentType<{ className?: string }>> = {
  shield: Shield,
  briefcase: Briefcase,
  package: Package,
  cpu: Cpu,
  user: User,
  bot: Bot,
};

const biasColors: Record<string, string> = {
  cautious: "text-amber-400",
  optimistic: "text-green-400",
  balanced: "text-blue-400",
  pragmatic: "text-purple-400",
  neutral: "text-gray-400",
};

export function PerspectiveCard({
  perspective,
  selected,
  compact = false,
  onClick,
  onSelect,
}: PerspectiveCardProps) {
  const [expanded, setExpanded] = useState(false);
  const Icon = avatarIcons[perspective.suggestedAvatar] || User;

  if (compact) {
    return (
      <motion.div
        whileHover={{ scale: 1.01 }}
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer",
          selected
            ? "border-purple-500 bg-purple-900/20"
            : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
        )}
        onClick={onClick}
      >
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${perspective.suggestedColor}20` }}
        >
          <span style={{ color: perspective.suggestedColor }}>
            <Icon className="w-4 h-4" />
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm text-white truncate">
              {perspective.name}
            </span>
            <span className={cn("text-xs", biasColors[perspective.bias])}>
              ({perspective.bias})
            </span>
          </div>
          <p className="text-xs text-gray-400 truncate">{perspective.role}</p>
        </div>
        {onSelect && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(!selected);
            }}
            className={cn(
              "w-5 h-5 rounded border-2 flex items-center justify-center transition-colors",
              selected
                ? "border-purple-500 bg-purple-500"
                : "border-gray-500 hover:border-gray-400"
            )}
          >
            {selected && <Check className="w-3 h-3 text-white" />}
          </button>
        )}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border overflow-hidden transition-colors",
        selected
          ? "border-purple-500 bg-purple-900/10"
          : "border-gray-700 bg-gray-800/30"
      )}
    >
      {/* Header */}
      <div
        className="p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${perspective.suggestedColor}20` }}
        >
          <span style={{ color: perspective.suggestedColor }}>
            <Icon className="w-5 h-5" />
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white">{perspective.name}</h3>
            <span
              className={cn(
                "px-2 py-0.5 text-xs rounded-full",
                biasColors[perspective.bias],
                "bg-gray-800"
              )}
            >
              {perspective.bias}
            </span>
          </div>
          <p className="text-sm text-gray-400">{perspective.role}</p>
        </div>
        <div className="flex items-center gap-2">
          {onSelect && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect(!selected);
              }}
              className={cn(
                "w-6 h-6 rounded border-2 flex items-center justify-center transition-colors",
                selected
                  ? "border-purple-500 bg-purple-500"
                  : "border-gray-500 hover:border-gray-400"
              )}
            >
              {selected && <Check className="w-4 h-4 text-white" />}
            </button>
          )}
          {expanded ? (
            <ChevronDown className="w-5 h-5 text-gray-500" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-500" />
          )}
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="border-t border-gray-700"
        >
          <div className="p-4 space-y-4">
            {/* Viewpoint */}
            <div>
              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
                Viewpoint
              </h4>
              <p className="text-sm text-gray-200">{perspective.viewpoint}</p>
            </div>

            {/* Key Arguments */}
            {perspective.keyArguments.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  Key Arguments
                </h4>
                <ul className="space-y-1">
                  {perspective.keyArguments.map((arg, i) => (
                    <li
                      key={i}
                      className="text-sm text-gray-300 flex items-start gap-2"
                    >
                      <span
                        className="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: perspective.suggestedColor }}
                      />
                      {arg}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Color preview */}
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: perspective.suggestedColor }}
              />
              <span className="text-xs text-gray-500 font-mono">
                {perspective.suggestedColor}
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
