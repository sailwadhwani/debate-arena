"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Brain, Wrench, Eye, CheckCircle, Scale, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { ModeratorStep, DebateSummary } from "@/lib/agents/types";
import { cn } from "@/lib/utils";

interface ModeratorStepWithRound extends ModeratorStep {
  round?: number;
}

interface ModeratorPanelProps {
  steps: ModeratorStepWithRound[];
  currentRound: number;
  isActive: boolean;
  summary?: DebateSummary;
}

export function ModeratorPanel({
  steps,
  currentRound,
  isActive,
  summary,
}: ModeratorPanelProps) {
  // Group steps by round
  const stepsByRound = steps.reduce((acc, step) => {
    const round = step.round || currentRound;
    if (!acc[round]) acc[round] = [];
    acc[round].push(step);
    return acc;
  }, {} as Record<number, ModeratorStepWithRound[]>);

  const roundNumbers = Object.keys(stepsByRound).map(Number).sort((a, b) => a - b);

  return (
    <div className="bg-gray-900 text-white rounded-xl border border-gray-700 overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-purple-900/50 to-indigo-900/50 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "p-2 rounded-lg",
              isActive ? "bg-purple-500/20 animate-pulse" : "bg-gray-800"
            )}
          >
            <Scale className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Debate Moderator</h3>
            <p className="text-xs text-gray-400">
              {isActive ? `Evaluating round ${currentRound}...` :
               summary ? "Debate concluded" :
               steps.length > 0 ? `${steps.length} total evaluations` : "Waiting for debate..."}
            </p>
          </div>
        </div>
      </div>

      {/* Steps grouped by round - scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {roundNumbers.map((roundNum) => (
          <RoundSection
            key={roundNum}
            round={roundNum}
            steps={stepsByRound[roundNum]}
            isCurrentRound={roundNum === currentRound}
            isActive={isActive && roundNum === currentRound}
          />
        ))}

        {steps.length === 0 && !summary && (
          <div className="text-center py-8 text-gray-500">
            <Brain className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Moderator will evaluate after each round</p>
            <p className="text-xs mt-1 text-gray-600">All evaluations will be preserved here</p>
          </div>
        )}

        {/* Final summary */}
        {summary && <FinalSummaryCard summary={summary} />}
      </div>
    </div>
  );
}

function RoundSection({
  round,
  steps,
  isCurrentRound,
  isActive,
}: {
  round: number;
  steps: ModeratorStepWithRound[];
  isCurrentRound: boolean;
  isActive: boolean;
}) {
  const [expanded, setExpanded] = useState(isCurrentRound);
  const decision = steps.find((s) => s.type === "decision");

  return (
    <div className={cn(
      "border rounded-lg overflow-hidden",
      isCurrentRound ? "border-purple-600/50 bg-purple-900/10" : "border-gray-700 bg-gray-800/30"
    )}>
      {/* Round header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-800/50 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500" />
        )}
        <span className={cn(
          "font-medium text-sm",
          isCurrentRound ? "text-purple-300" : "text-gray-300"
        )}>
          Round {round}
        </span>
        {isActive && (
          <span className="px-2 py-0.5 text-xs bg-purple-500/30 text-purple-300 rounded-full animate-pulse">
            Active
          </span>
        )}
        {decision && (
          <span className={cn(
            "ml-auto px-2 py-0.5 text-xs rounded-full",
            decision.decision === "conclude"
              ? "bg-green-500/30 text-green-300"
              : "bg-blue-500/30 text-blue-300"
          )}>
            {decision.decision === "conclude" ? "Concluded" : "Continue"}
          </span>
        )}
        <span className="text-xs text-gray-500">{steps.length} steps</span>
      </button>

      {/* Steps */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-gray-700/50"
          >
            <div className="p-3 space-y-2">
              {steps.map((step, i) => (
                <ModeratorStepCard key={i} step={step} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ModeratorStepCard({ step }: { step: ModeratorStepWithRound }) {
  const config = {
    thinking: {
      icon: Brain,
      color: "text-blue-400",
      bgColor: "bg-blue-900/20",
      borderColor: "border-blue-800/50",
      label: "Thinking",
    },
    acting: {
      icon: Wrench,
      color: "text-amber-400",
      bgColor: "bg-amber-900/20",
      borderColor: "border-amber-800/50",
      label: "Acting",
    },
    observing: {
      icon: Eye,
      color: "text-green-400",
      bgColor: "bg-green-900/20",
      borderColor: "border-green-800/50",
      label: "Observing",
    },
    decision: {
      icon: CheckCircle,
      color: step.decision === "conclude" ? "text-green-400" : "text-blue-400",
      bgColor: step.decision === "conclude" ? "bg-green-900/20" : "bg-blue-900/20",
      borderColor:
        step.decision === "conclude" ? "border-green-800/50" : "border-blue-800/50",
      label: step.decision === "conclude" ? "Decision: Conclude" : "Decision: Continue",
    },
  };

  const { icon: Icon, color, bgColor, borderColor, label } = config[step.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn("p-3 rounded-lg border", bgColor, borderColor)}
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={cn("w-4 h-4", color)} />
        <span className={cn("text-xs font-medium uppercase tracking-wide", color)}>
          {label}
        </span>
      </div>

      {step.type === "acting" && step.toolCall && (
        <div className="mb-2 p-2 bg-gray-800 rounded text-xs font-mono">
          <span className="text-amber-400">{step.toolCall.name}</span>
          <span className="text-gray-500">(</span>
          <span className="text-gray-400">
            {JSON.stringify(step.toolCall.input)}
          </span>
          <span className="text-gray-500">)</span>
        </div>
      )}

      {step.type === "observing" && step.toolResult && (
        <div className="p-2 bg-gray-800 rounded text-xs text-green-300 font-mono max-h-24 overflow-y-auto">
          {step.toolResult}
        </div>
      )}

      {(step.type === "thinking" || step.type === "decision") && step.content && (
        <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{step.content}</p>
      )}
    </motion.div>
  );
}

function FinalSummaryCard({ summary }: { summary: DebateSummary }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-4 rounded-lg bg-gradient-to-br from-purple-900/40 to-indigo-900/40 border border-purple-600/50"
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 mb-3"
      >
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        <CheckCircle className="w-5 h-5 text-purple-400" />
        <span className="font-semibold text-purple-300">Final Summary</span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="space-y-4"
          >
            {/* Consensus meter */}
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-400 w-20">Consensus:</span>
              <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all duration-500"
                  style={{ width: `${summary.consensus}%` }}
                />
              </div>
              <span className="text-sm font-bold text-white w-12 text-right">{summary.consensus}%</span>
            </div>

            {/* Key agreements */}
            {summary.keyAgreements && summary.keyAgreements.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-green-400 uppercase tracking-wide mb-2">
                  Key Agreements
                </h4>
                <ul className="space-y-1">
                  {summary.keyAgreements.map((item, i) => (
                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-green-400">✓</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Key disagreements */}
            {summary.keyDisagreements && summary.keyDisagreements.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-amber-400 uppercase tracking-wide mb-2">
                  Key Disagreements
                </h4>
                <ul className="space-y-1">
                  {summary.keyDisagreements.map((item, i) => (
                    <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                      <span className="text-amber-400">⚡</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendation */}
            <div>
              <h4 className="text-xs font-semibold text-purple-400 uppercase tracking-wide mb-2">
                Recommendation
              </h4>
              <p className="text-sm text-gray-200 leading-relaxed">{summary.recommendation}</p>
            </div>

            {/* Reasoning */}
            {summary.reasoning && (
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  Moderator's Reasoning
                </h4>
                <p className="text-sm text-gray-400 leading-relaxed">{summary.reasoning}</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
