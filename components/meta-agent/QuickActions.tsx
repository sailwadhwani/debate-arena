"use client";

import { motion } from "framer-motion";
import {
  Play,
  Save,
  RefreshCw,
  Plus,
  Settings,
  BookOpen,
  MessageSquare,
  Wand2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  variant?: "primary" | "secondary" | "success";
}

interface QuickActionsProps {
  actions: QuickAction[];
  onAction: (actionId: string) => void;
  disabled?: boolean;
}

const defaultActions: QuickAction[] = [
  {
    id: "start_debate",
    label: "Start Debate",
    icon: Play,
    description: "Begin the debate with current agents",
    variant: "success",
  },
  {
    id: "save_agents",
    label: "Save Agents",
    icon: Save,
    description: "Save generated agents to config",
    variant: "primary",
  },
  {
    id: "regenerate",
    label: "Regenerate",
    icon: RefreshCw,
    description: "Generate new perspectives",
  },
  {
    id: "add_perspective",
    label: "Add More",
    icon: Plus,
    description: "Add another perspective",
  },
];

export function QuickActions({
  actions = defaultActions,
  onAction,
  disabled = false,
}: QuickActionsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {actions.map((action, index) => (
        <motion.button
          key={action.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.05 }}
          onClick={() => onAction(action.id)}
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            action.variant === "success"
              ? "bg-green-600 text-white hover:bg-green-700"
              : action.variant === "primary"
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-gray-700 text-gray-200 hover:bg-gray-600"
          )}
          title={action.description}
        >
          <action.icon className="w-4 h-4" />
          {action.label}
        </motion.button>
      ))}
    </div>
  );
}

interface SuggestedPromptsProps {
  prompts: string[];
  onSelect: (prompt: string) => void;
}

export function SuggestedPrompts({ prompts, onSelect }: SuggestedPromptsProps) {
  if (prompts.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500 uppercase tracking-wide">
        Suggested prompts
      </p>
      <div className="flex flex-wrap gap-2">
        {prompts.map((prompt, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => onSelect(prompt)}
            className="px-3 py-1.5 text-xs text-gray-300 bg-gray-800 rounded-full hover:bg-gray-700 transition-colors"
          >
            {prompt}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

interface ActionBarProps {
  hasAnalysis: boolean;
  hasAgents: boolean;
  onStartDebate: () => void;
  onSaveAgents: () => void;
  onGenerateAgents: () => void;
  onRegenerate: () => void;
  onAddPerspective: () => void;
  onOpenSettings: () => void;
  onViewInstructions: () => void;
  loading?: boolean;
}

export function ActionBar({
  hasAnalysis,
  hasAgents,
  onStartDebate,
  onSaveAgents,
  onGenerateAgents,
  onRegenerate,
  onAddPerspective,
  onOpenSettings,
  onViewInstructions,
  loading = false,
}: ActionBarProps) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 bg-gray-900/50 border-t border-gray-800">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Generate Agents button - shown when we have perspectives but no agents yet */}
        {hasAnalysis && !hasAgents && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={onGenerateAgents}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
          >
            <Wand2 className={cn("w-4 h-4", loading && "animate-pulse")} />
            Generate Agents
          </motion.button>
        )}
        {hasAgents && (
          <>
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={onStartDebate}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              Start Debate
            </motion.button>
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 }}
              onClick={onSaveAgents}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Save
            </motion.button>
          </>
        )}
        {hasAnalysis && (
          <>
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              onClick={onRegenerate}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              Regenerate
            </motion.button>
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
              onClick={onAddPerspective}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Add
            </motion.button>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onViewInstructions}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          title="View Instructions"
        >
          <BookOpen className="w-4 h-4" />
        </button>
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
          title="Settings"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
