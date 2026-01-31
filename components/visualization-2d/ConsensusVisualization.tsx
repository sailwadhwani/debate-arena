"use client";

import { motion } from "framer-motion";
import { Users, CheckCircle2, MessageSquare } from "lucide-react";
import { VoteDistribution } from "./VoteDistribution";
import { AgreementIndicator } from "./AgreementIndicator";
import type { DebateSummary, DebateArgument } from "@/lib/agents/types";

interface ConsensusVisualizationProps {
  arguments: DebateArgument[];
  summary?: DebateSummary;
  task: string;
}

export function ConsensusVisualization({
  arguments: args,
  summary,
  task,
}: ConsensusVisualizationProps) {
  // Get latest argument from each agent
  const latestVotes = new Map<string, DebateArgument>();
  args.forEach((arg) => {
    const existing = latestVotes.get(arg.agentId);
    if (!existing || arg.round > existing.round) {
      latestVotes.set(arg.agentId, arg);
    }
  });

  const votes = Array.from(latestVotes.values()).map((arg) => ({
    agentId: arg.agentId,
    agentName: arg.agentName,
    agentColor: arg.agentColor,
    score: arg.score,
    confidence: arg.confidence,
  }));

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="p-5 bg-gradient-to-r from-indigo-50/80 to-purple-50/80 dark:from-indigo-900/10 dark:to-purple-900/10 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
            <Users className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              Multi-Agent Consensus
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
              {task}
            </p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* Vote distribution */}
        {votes.length > 0 && (
          <VoteDistribution
            votes={votes}
            averageScore={summary?.consensus ? summary.consensus / 20 : undefined}
          />
        )}

        {/* Agreement indicator */}
        {votes.length >= 2 && <AgreementIndicator votes={votes} />}

        {/* Summary (if complete) */}
        {summary && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Key agreements */}
            {summary.keyAgreements.length > 0 && (
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800/50">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-green-700 dark:text-green-400 text-sm">
                    Key Agreements
                  </span>
                </div>
                <ul className="space-y-1">
                  {summary.keyAgreements.map((agreement, i) => (
                    <li key={i} className="text-sm text-green-700 dark:text-green-300">
                      {agreement}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Key disagreements */}
            {summary.keyDisagreements.length > 0 && (
              <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-amber-600" />
                  <span className="font-medium text-amber-700 dark:text-amber-400 text-sm">
                    Key Disagreements
                  </span>
                </div>
                <ul className="space-y-1">
                  {summary.keyDisagreements.map((disagreement, i) => (
                    <li key={i} className="text-sm text-amber-700 dark:text-amber-300">
                      {disagreement}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Final recommendation */}
            <div className="p-5 rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/10 dark:to-purple-900/10 border border-indigo-200 dark:border-indigo-800/50">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span className="font-semibold text-indigo-700 dark:text-indigo-400">
                  Final Recommendation
                </span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
                {summary.recommendation}
              </p>
              <div className="text-xs text-gray-500 dark:text-gray-400 pt-3 border-t border-indigo-200 dark:border-indigo-800/50">
                {summary.reasoning}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
