"use client";

import { CheckCircle2, AlertTriangle, Scale } from "lucide-react";
import { cn } from "@/lib/utils";

type AgreementLevel = "high" | "medium" | "low";

interface AgreementIndicatorProps {
  votes: { score?: number }[];
  className?: string;
}

export function AgreementIndicator({ votes, className }: AgreementIndicatorProps) {
  const validVotes = votes.filter((v) => v.score !== undefined);

  if (validVotes.length < 2) {
    return null;
  }

  // Calculate agreement level based on score variance
  const scores = validVotes.map((v) => v.score!);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const spread = maxScore - minScore;

  let level: AgreementLevel;
  if (spread <= 1) {
    level = "high";
  } else if (spread <= 2) {
    level = "medium";
  } else {
    level = "low";
  }

  const config = {
    high: {
      label: "High Agreement",
      description: "Agents are in consensus",
      icon: CheckCircle2,
      bgColor: "bg-green-50 dark:bg-green-900/20",
      textColor: "text-green-700 dark:text-green-400",
      iconColor: "text-green-600 dark:text-green-400",
      borderColor: "border-green-200 dark:border-green-800/50",
    },
    medium: {
      label: "Moderate Agreement",
      description: "Some differences in assessment",
      icon: Scale,
      bgColor: "bg-amber-50 dark:bg-amber-900/20",
      textColor: "text-amber-700 dark:text-amber-400",
      iconColor: "text-amber-600 dark:text-amber-400",
      borderColor: "border-amber-200 dark:border-amber-800/50",
    },
    low: {
      label: "Low Agreement",
      description: "Significant disagreement",
      icon: AlertTriangle,
      bgColor: "bg-red-50 dark:bg-red-900/20",
      textColor: "text-red-700 dark:text-red-400",
      iconColor: "text-red-600 dark:text-red-400",
      borderColor: "border-red-200 dark:border-red-800/50",
    },
  };

  const { label, description, icon: Icon, bgColor, textColor, iconColor, borderColor } =
    config[level];

  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-lg border",
        bgColor,
        borderColor,
        className
      )}
    >
      <Icon className={cn("w-5 h-5", iconColor)} />
      <div>
        <div className={cn("font-medium text-sm", textColor)}>{label}</div>
        <div className="text-xs text-gray-600 dark:text-gray-400">{description}</div>
      </div>
    </div>
  );
}

/**
 * Calculate agreement level from scores
 */
export function calculateAgreementLevel(scores: number[]): AgreementLevel {
  if (scores.length < 2) return "high";

  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const spread = maxScore - minScore;

  if (spread <= 1) return "high";
  if (spread <= 2) return "medium";
  return "low";
}
