"use client";

import { motion } from "framer-motion";
import { User, Bot, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/lib/meta-agent";
import { PerspectiveCard } from "./PerspectiveCard";

interface ChatMessageProps {
  message: ChatMessageType;
  onPerspectiveSelect?: (perspectiveId: string) => void;
  onAgentSelect?: (agentId: string) => void;
}

export function ChatMessage({
  message,
  onPerspectiveSelect,
  onAgentSelect,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center",
          isUser
            ? "bg-indigo-600"
            : isSystem
            ? "bg-gray-600"
            : "bg-gradient-to-br from-purple-600 to-indigo-600"
        )}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : isSystem ? (
          <Sparkles className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Message content */}
      <div
        className={cn(
          "flex-1 max-w-[85%]",
          isUser ? "items-end" : "items-start"
        )}
      >
        <div
          className={cn(
            "rounded-2xl px-4 py-3",
            isUser
              ? "bg-indigo-600 text-white rounded-tr-sm"
              : isSystem
              ? "bg-gray-700 text-gray-200 rounded-tl-sm"
              : "bg-gray-800 text-gray-100 rounded-tl-sm"
          )}
        >
          {/* Main message content */}
          <div className="text-sm leading-relaxed whitespace-pre-wrap">
            {formatMessageContent(message.content)}
          </div>

          {/* Perspectives */}
          {message.metadata?.perspectives &&
            message.metadata.perspectives.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Suggested Perspectives
                </p>
                <div className="space-y-2">
                  {message.metadata.perspectives.map((perspective) => (
                    <PerspectiveCard
                      key={perspective.id}
                      perspective={perspective}
                      compact
                      onClick={() => onPerspectiveSelect?.(perspective.id)}
                    />
                  ))}
                </div>
              </div>
            )}

          {/* Generated Agents */}
          {message.metadata?.generatedAgents &&
            message.metadata.generatedAgents.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Generated Agents
                </p>
                <div className="flex flex-wrap gap-2">
                  {message.metadata.generatedAgents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => onAgentSelect?.(agent.id)}
                      className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors hover:opacity-80"
                      style={{
                        backgroundColor: `${agent.color}20`,
                        color: agent.color,
                        borderColor: agent.color,
                        borderWidth: 1,
                      }}
                    >
                      {agent.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

          {/* Clarifying Questions */}
          {message.metadata?.clarifyingQuestions &&
            message.metadata.clarifyingQuestions.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs text-gray-400 uppercase tracking-wide">
                  Questions to Consider
                </p>
                <ul className="space-y-1">
                  {message.metadata.clarifyingQuestions.map((question, i) => (
                    <li
                      key={i}
                      className="text-xs text-gray-300 flex items-start gap-2"
                    >
                      <span className="text-purple-400">?</span>
                      {question}
                    </li>
                  ))}
                </ul>
              </div>
            )}
        </div>

        {/* Timestamp */}
        <p
          className={cn(
            "text-xs text-gray-500 mt-1",
            isUser ? "text-right" : "text-left"
          )}
        >
          {formatTime(message.timestamp)}
        </p>
      </div>
    </motion.div>
  );
}

function formatMessageContent(content: string): React.ReactNode {
  // Simple markdown-like formatting
  const parts = content.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
