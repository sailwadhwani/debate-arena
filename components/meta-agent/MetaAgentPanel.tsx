"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Send,
  Sparkles,
  Minimize2,
  Maximize2,
  MessageCircle,
  Loader2,
  BookOpen,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatMessage } from "./ChatMessage";
import { SuggestedPrompts, ActionBar } from "./QuickActions";
import type {
  ChatMessage as ChatMessageType,
  TopicAnalysis,
  SuggestedPerspective,
  Instruction,
} from "@/lib/meta-agent";
import type { AgentConfig } from "@/lib/agents/types";

interface MetaAgentPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onStartDebate?: (agents: AgentConfig[], topic: string) => void;
  minimized?: boolean;
  onToggleMinimize?: () => void;
}

const INITIAL_PROMPTS = [
  "I want to debate AI safety",
  "Help me set up a debate about climate policy",
  "What perspectives would be good for discussing remote work?",
  "Create agents for a tech ethics debate",
];

export function MetaAgentPanel({
  isOpen,
  onClose,
  onStartDebate,
  minimized = false,
  onToggleMinimize,
}: MetaAgentPanelProps) {
  const [messages, setMessages] = useState<ChatMessageType[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<TopicAnalysis | null>(null);
  const [generatedAgents, setGeneratedAgents] = useState<AgentConfig[]>([]);
  const [showInstructions, setShowInstructions] = useState(false);
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load instructions on mount
  useEffect(() => {
    async function loadInstructions() {
      try {
        const response = await fetch("/api/meta-agent/instructions");
        if (response.ok) {
          const data = await response.json();
          setInstructions(data.instructions || []);
        }
      } catch (error) {
        console.error("Failed to load instructions:", error);
      }
    }
    if (isOpen) {
      loadInstructions();
    }
  }, [isOpen]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && !minimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, minimized]);

  // Add initial greeting
  useEffect(() => {
    if (messages.length === 0 && isOpen) {
      const greeting: ChatMessageType = {
        id: "greeting",
        role: "assistant",
        content:
          "Hello! I'm the Meta-Agent for Debate Arena. I can help you set up debates by:\n\n" +
          "- Analyzing topics and suggesting perspectives\n" +
          "- Creating debate agents with distinct viewpoints\n" +
          "- Remembering your preferences for future sessions\n\n" +
          "What topic would you like to debate today?",
        timestamp: new Date().toISOString(),
      };
      setMessages([greeting]);
    }
  }, [isOpen, messages.length]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || loading) return;

    const userMessage: ChatMessageType = {
      id: `user-${Date.now()}`,
      role: "user",
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/meta-agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          conversationId,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      setConversationId(data.conversationId);

      const assistantMessage = data.message as ChatMessageType;
      setMessages((prev) => [...prev, assistantMessage]);

      // Update state based on metadata
      if (assistantMessage.metadata?.perspectives) {
        setCurrentAnalysis({
          topic: content,
          domains: ["general"],
          complexity: "moderate",
          suggestedPerspectives: assistantMessage.metadata.perspectives,
          clarifyingQuestions: assistantMessage.metadata.clarifyingQuestions || [],
          keyTerms: [],
        });
      }

      if (assistantMessage.metadata?.generatedAgents) {
        setGeneratedAgents(assistantMessage.metadata.generatedAgents);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      const errorMessage: ChatMessageType = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content:
          "I encountered an error processing your request. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  }, [conversationId, loading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleStartDebate = async () => {
    if (generatedAgents.length === 0) return;

    const topic = currentAnalysis?.topic || "Unknown topic";

    // Save agents first
    try {
      setLoading(true);
      const response = await fetch("/api/meta-agent/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          agents: generatedAgents,
          topic,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save agents");
      }

      onStartDebate?.(generatedAgents, topic);
      onClose();
    } catch (error) {
      console.error("Error starting debate:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAgents = async () => {
    if (generatedAgents.length === 0) return;

    try {
      setLoading(true);
      const response = await fetch("/api/meta-agent/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save",
          agents: generatedAgents,
          topic: currentAnalysis?.topic || "Unknown topic",
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save agents");
      }

      const confirmMessage: ChatMessageType = {
        id: `system-${Date.now()}`,
        role: "assistant",
        content: `Saved ${generatedAgents.length} agents to your configuration. They're now available in the Agents page.`,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, confirmMessage]);
    } catch (error) {
      console.error("Error saving agents:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = () => {
    if (currentAnalysis) {
      sendMessage(`Regenerate perspectives for ${currentAnalysis.topic}`);
    }
  };

  const handleAddPerspective = () => {
    if (currentAnalysis) {
      sendMessage(`Add another perspective for ${currentAnalysis.topic}`);
    }
  };

  const handleGenerateAgents = async () => {
    if (!currentAnalysis) return;

    setLoading(true);
    try {
      const response = await fetch("/api/meta-agent/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          topic: currentAnalysis.topic,
          perspectives: currentAnalysis.suggestedPerspectives,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate agents");
      }

      const data = await response.json();
      setGeneratedAgents(data.agents);

      const confirmMessage: ChatMessageType = {
        id: `system-${Date.now()}`,
        role: "assistant",
        content: `Generated ${data.agents.length} agents based on the perspectives:\n\n${data.agents.map((a: AgentConfig) => `- **${a.name}** (${a.bias})`).join("\n")}\n\nYou can now **Start Debate** or **Save** the agents to your config.`,
        timestamp: new Date().toISOString(),
        metadata: { generatedAgents: data.agents },
      };
      setMessages((prev) => [...prev, confirmMessage]);
    } catch (error) {
      console.error("Error generating agents:", error);
      const errorMessage: ChatMessageType = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Failed to generate agents. Please try again.",
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteInstruction = async (id: string) => {
    try {
      const response = await fetch(`/api/meta-agent/instructions?id=${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setInstructions((prev) => prev.filter((i) => i.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete instruction:", error);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 400 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 400 }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className={cn(
          "fixed right-4 z-50 bg-gray-900 rounded-2xl border border-gray-700 shadow-2xl flex flex-col overflow-hidden",
          minimized
            ? "bottom-4 w-80 h-14"
            : "top-20 bottom-4 w-[420px]"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-900/50 to-indigo-900/50 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Sparkles className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white text-sm">Meta-Agent</h3>
              {!minimized && (
                <p className="text-xs text-gray-400">
                  {loading ? "Thinking..." : "Ready to help"}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={onToggleMinimize}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              {minimized ? (
                <Maximize2 className="w-4 h-4" />
              ) : (
                <Minimize2 className="w-4 h-4" />
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {!minimized && (
          <>
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onPerspectiveSelect={(id) => {
                    // Handle perspective selection
                  }}
                  onAgentSelect={(id) => {
                    // Handle agent selection
                  }}
                />
              ))}
              {loading && (
                <div className="flex items-center gap-2 text-gray-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Thinking...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggested prompts (only when no messages beyond greeting) */}
            {messages.length <= 1 && (
              <div className="px-4 pb-2">
                <SuggestedPrompts
                  prompts={INITIAL_PROMPTS}
                  onSelect={(prompt) => sendMessage(prompt)}
                />
              </div>
            )}

            {/* Action bar */}
            {(currentAnalysis || generatedAgents.length > 0) && (
              <ActionBar
                hasAnalysis={!!currentAnalysis}
                hasAgents={generatedAgents.length > 0}
                onStartDebate={handleStartDebate}
                onSaveAgents={handleSaveAgents}
                onGenerateAgents={handleGenerateAgents}
                onRegenerate={handleRegenerate}
                onAddPerspective={handleAddPerspective}
                onOpenSettings={() => window.open("/settings", "_blank")}
                onViewInstructions={() => setShowInstructions(true)}
                loading={loading}
              />
            )}

            {/* Instructions Panel */}
            <AnimatePresence>
              {showInstructions && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="absolute inset-x-0 bottom-0 bg-gray-900 border-t border-gray-700 rounded-t-xl max-h-[60%] overflow-hidden flex flex-col"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                    <div className="flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-purple-400" />
                      <h3 className="font-semibold text-white text-sm">Saved Instructions</h3>
                    </div>
                    <button
                      onClick={() => setShowInstructions(false)}
                      className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {instructions.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-4">
                        No instructions saved yet. Tell me something like &quot;Always create 4 agents&quot; or &quot;Remember to include a skeptic perspective&quot;.
                      </p>
                    ) : (
                      instructions.map((instruction) => (
                        <div
                          key={instruction.id}
                          className={cn(
                            "flex items-start justify-between gap-2 p-3 rounded-lg border",
                            instruction.active
                              ? "bg-purple-900/20 border-purple-700/50"
                              : "bg-gray-800/50 border-gray-700/50 opacity-60"
                          )}
                        >
                          <div className="flex-1">
                            <p className="text-sm text-gray-200">{instruction.content}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {instruction.category} • {new Date(instruction.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteInstruction(instruction.id)}
                            className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-900/20"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input */}
            <form
              onSubmit={handleSubmit}
              className="p-4 border-t border-gray-800"
            >
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your message..."
                  rows={1}
                  className="flex-1 bg-gray-800 text-white text-sm rounded-xl px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 placeholder-gray-500"
                  style={{ minHeight: "44px", maxHeight: "120px" }}
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="p-3 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

// Floating button to open the panel
interface MetaAgentButtonProps {
  onClick: () => void;
  hasNotification?: boolean;
}

export function MetaAgentButton({ onClick, hasNotification }: MetaAgentButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="fixed bottom-6 right-6 z-40 p-4 bg-gradient-to-br from-purple-600 to-indigo-600 text-white rounded-full shadow-lg hover:shadow-purple-500/25 transition-shadow"
    >
      <MessageCircle className="w-6 h-6" />
      {hasNotification && (
        <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full border-2 border-gray-900" />
      )}
    </motion.button>
  );
}
