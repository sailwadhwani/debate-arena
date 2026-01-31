"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Brain, Wrench, Eye, CheckCircle, Scale } from "lucide-react";
import type { ModeratorStep, DebateSummary } from "@/lib/agents/types";
import { cn } from "@/lib/utils";

interface ModeratorPanelProps {
  steps: ModeratorStep[];
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
  return (
    <div className="bg-gray-900 text-white rounded-xl border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gradient-to-r from-purple-900/50 to-indigo-900/50 border-b border-gray-700">
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
              {isActive ? "Evaluating round " + currentRound : "Waiting..."}
            </p>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
        <AnimatePresence mode="popLayout">
          {steps.map((step, i) => (
            <ModeratorStepCard key={i} step={step} />
          ))}
        </AnimatePresence>

        {steps.length === 0 && !summary && (
          <div className="text-center py-8 text-gray-500">
            <Brain className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Moderator will evaluate after agents speak</p>
          </div>
        )}

        {/* Final summary */}
        {summary && <FinalSummaryCard summary={summary} />}
      </div>
    </div>
  );
}

function ModeratorStepCard({ step }: { step: ModeratorStep }) {
  const config = {
    thinking: {
      icon: Brain,
      color: "text-blue-400",
      bgColor: "bg-blue-900/20",
      borderColor: "border-blue-800/50",
      label: "Thinking...",
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
      label: step.decision === "conclude" ? "Conclude" : "Continue",
    },
  };

  const { icon: Icon, color, bgColor, borderColor, label } = config[step.type];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
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
        <div className="p-2 bg-gray-800 rounded text-xs text-green-300 font-mono max-h-20 overflow-y-auto">
          {step.toolResult}
        </div>
      )}

      {(step.type === "thinking" || step.type === "decision") && (
        <p className="text-sm text-gray-300 leading-relaxed">{step.content}</p>
      )}
    </motion.div>
  );
}

function FinalSummaryCard({ summary }: { summary: DebateSummary }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-4 rounded-lg bg-gradient-to-br from-purple-900/30 to-indigo-900/30 border border-purple-700/50"
    >
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle className="w-5 h-5 text-purple-400" />
        <span className="font-semibold text-purple-300">Debate Complete</span>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <span className="text-sm text-gray-400">Consensus:</span>
        <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full"
            style={{ width: `${summary.consensus}%` }}
          />
        </div>
        <span className="text-sm font-bold text-white">{summary.consensus}%</span>
      </div>

      <p className="text-sm text-gray-300 leading-relaxed">{summary.recommendation}</p>
    </motion.div>
  );
}
