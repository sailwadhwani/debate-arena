"use client";

import { motion } from "framer-motion";
import type { DebateArgument } from "@/lib/agents/types";

interface AgentVote {
  agentId: string;
  agentName: string;
  agentColor: string;
  score?: number;
  confidence?: number;
}

interface VoteDistributionProps {
  votes: AgentVote[];
  averageScore?: number;
}

export function VoteDistribution({ votes, averageScore }: VoteDistributionProps) {
  const validVotes = votes.filter((v) => v.score !== undefined);

  if (validVotes.length === 0) {
    return (
      <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg text-center text-gray-500">
        No votes yet
      </div>
    );
  }

  const calculatedAverage =
    averageScore ??
    validVotes.reduce((sum, v) => sum + (v.score || 0), 0) / validVotes.length;

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-900/30 rounded-xl">
      <div className="flex items-center gap-3 mb-3">
        <span className="text-sm text-gray-500 dark:text-gray-400 font-medium">
          Scores:
        </span>

        <div className="flex-1 flex items-center gap-1.5">
          {votes.map((vote, i) => (
            <motion.div
              key={vote.agentId}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.1 }}
              className="flex-1 h-9 rounded-lg flex items-center justify-center text-white text-sm font-semibold shadow-sm transition-transform hover:scale-105"
              style={{ backgroundColor: vote.agentColor }}
              title={`${vote.agentName}: ${vote.score ?? "-"}/5`}
            >
              {vote.score ?? "-"}
            </motion.div>
          ))}
        </div>

        <div className="flex items-center gap-2 pl-3 border-l-2 border-gray-200 dark:border-gray-600">
          <span className="text-xs text-gray-500">Avg:</span>
          <span className="text-lg font-bold text-gray-900 dark:text-white">
            {calculatedAverage.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Score distribution bar */}
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden flex">
        {[1, 2, 3, 4, 5].map((score) => {
          const count = validVotes.filter((v) => v.score === score).length;
          const percentage = (count / validVotes.length) * 100;

          if (percentage === 0) return null;

          const colors = {
            1: "#22c55e",
            2: "#84cc16",
            3: "#eab308",
            4: "#f97316",
            5: "#ef4444",
          };

          return (
            <div
              key={score}
              className="h-full transition-all"
              style={{
                width: `${percentage}%`,
                backgroundColor: colors[score as keyof typeof colors],
              }}
              title={`Score ${score}: ${count} vote(s)`}
            />
          );
        })}
      </div>
    </div>
  );
}
