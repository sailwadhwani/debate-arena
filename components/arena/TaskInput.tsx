"use client";

import { useState } from "react";
import { MessageSquare, Lightbulb } from "lucide-react";

interface TaskInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

const EXAMPLE_TASKS = [
  "Evaluate the risks and benefits of this proposal",
  "Identify compliance issues and business opportunities",
  "Review this contract for potential problems",
  "Analyze the strategic implications of this decision",
];

export function TaskInput({ value, onChange, disabled }: TaskInputProps) {
  const [showExamples, setShowExamples] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Debate Task
        </label>
        <button
          type="button"
          onClick={() => setShowExamples(!showExamples)}
          className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 flex items-center gap-1"
        >
          <Lightbulb className="w-3 h-3" />
          {showExamples ? "Hide examples" : "Show examples"}
        </button>
      </div>

      <div className="relative">
        <MessageSquare className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder="What should the agents debate? e.g., 'Evaluate the risks and opportunities in this proposal'"
          rows={3}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none disabled:opacity-50"
        />
      </div>

      {showExamples && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_TASKS.map((example, i) => (
            <button
              key={i}
              onClick={() => onChange(example)}
              className="px-3 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {example}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
