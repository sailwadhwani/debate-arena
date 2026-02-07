"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type {
  ChatMessage,
  TopicAnalysis,
  SuggestedPerspective,
  Instruction,
  MetaAgentMemory,
} from "@/lib/meta-agent";
import type { AgentConfig } from "@/lib/agents/types";

interface MetaAgentContextValue {
  // Panel state
  isPanelOpen: boolean;
  isPanelMinimized: boolean;
  openPanel: () => void;
  closePanel: () => void;
  toggleMinimize: () => void;

  // Conversation state
  messages: ChatMessage[];
  loading: boolean;
  conversationId: string | null;
  currentAnalysis: TopicAnalysis | null;
  generatedAgents: AgentConfig[];
  instructions: Instruction[];
  memory: MetaAgentMemory | null;

  // Actions
  sendMessage: (content: string) => Promise<void>;
  analyzeTopic: (topic: string, context?: string) => Promise<TopicAnalysis | null>;
  generateAgents: (
    topic: string,
    perspectives: SuggestedPerspective[],
    saveToConfig?: boolean
  ) => Promise<AgentConfig[]>;
  saveAgents: (agents: AgentConfig[], topic: string) => Promise<boolean>;
  addInstruction: (content: string, category?: Instruction["category"]) => Promise<Instruction | null>;
  loadMemory: () => Promise<void>;
  clearConversation: () => void;
  setGeneratedAgents: (agents: AgentConfig[]) => void;
}

const MetaAgentContext = createContext<MetaAgentContextValue | null>(null);

export function MetaAgentProvider({ children }: { children: ReactNode }) {
  // Panel state
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [isPanelMinimized, setIsPanelMinimized] = useState(false);

  // Conversation state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [currentAnalysis, setCurrentAnalysis] = useState<TopicAnalysis | null>(null);
  const [generatedAgents, setGeneratedAgents] = useState<AgentConfig[]>([]);
  const [instructions, setInstructions] = useState<Instruction[]>([]);
  const [memory, setMemory] = useState<MetaAgentMemory | null>(null);

  // Load memory on mount
  useEffect(() => {
    loadMemoryAction();
  }, []);

  const openPanel = useCallback(() => {
    setIsPanelOpen(true);
    setIsPanelMinimized(false);
  }, []);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
  }, []);

  const toggleMinimize = useCallback(() => {
    setIsPanelMinimized((prev) => !prev);
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || loading) return;

      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: content.trim(),
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
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

        const assistantMessage = data.message as ChatMessage;
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
        const errorMessage: ChatMessage = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: "I encountered an error processing your request. Please try again.",
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setLoading(false);
      }
    },
    [conversationId, loading]
  );

  const analyzeTopic = useCallback(
    async (topic: string, context?: string): Promise<TopicAnalysis | null> => {
      setLoading(true);
      try {
        const response = await fetch("/api/meta-agent/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "analyze", topic, context }),
        });

        if (!response.ok) {
          throw new Error("Failed to analyze topic");
        }

        const data = await response.json();
        setCurrentAnalysis(data.analysis);
        return data.analysis;
      } catch (error) {
        console.error("Error analyzing topic:", error);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const generateAgentsAction = useCallback(
    async (
      topic: string,
      perspectives: SuggestedPerspective[],
      saveToConfig: boolean = false
    ): Promise<AgentConfig[]> => {
      setLoading(true);
      try {
        const response = await fetch("/api/meta-agent/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "generate",
            topic,
            perspectives,
            saveToConfig,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to generate agents");
        }

        const data = await response.json();
        setGeneratedAgents(data.agents);
        return data.agents;
      } catch (error) {
        console.error("Error generating agents:", error);
        return [];
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const saveAgents = useCallback(
    async (agents: AgentConfig[], topic: string): Promise<boolean> => {
      setLoading(true);
      try {
        const response = await fetch("/api/meta-agent/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "save", agents, topic }),
        });

        if (!response.ok) {
          throw new Error("Failed to save agents");
        }

        const data = await response.json();
        return data.success !== false;
      } catch (error) {
        console.error("Error saving agents:", error);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const addInstructionAction = useCallback(
    async (
      content: string,
      category: Instruction["category"] = "general"
    ): Promise<Instruction | null> => {
      try {
        const response = await fetch("/api/meta-agent/instructions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, category }),
        });

        if (!response.ok) {
          throw new Error("Failed to add instruction");
        }

        const data = await response.json();
        setInstructions(data.instructions);
        return data.instructions[data.instructions.length - 1];
      } catch (error) {
        console.error("Error adding instruction:", error);
        return null;
      }
    },
    []
  );

  const loadMemoryAction = useCallback(async () => {
    try {
      const response = await fetch("/api/meta-agent/memory");
      if (!response.ok) {
        throw new Error("Failed to load memory");
      }

      const data = await response.json();
      setMemory(data);
      setInstructions(data.instructions || []);
    } catch (error) {
      console.error("Error loading memory:", error);
    }
  }, []);

  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setCurrentAnalysis(null);
    setGeneratedAgents([]);
  }, []);

  const value: MetaAgentContextValue = {
    // Panel state
    isPanelOpen,
    isPanelMinimized,
    openPanel,
    closePanel,
    toggleMinimize,

    // Conversation state
    messages,
    loading,
    conversationId,
    currentAnalysis,
    generatedAgents,
    instructions,
    memory,

    // Actions
    sendMessage,
    analyzeTopic,
    generateAgents: generateAgentsAction,
    saveAgents,
    addInstruction: addInstructionAction,
    loadMemory: loadMemoryAction,
    clearConversation,
    setGeneratedAgents,
  };

  return (
    <MetaAgentContext.Provider value={value}>
      {children}
    </MetaAgentContext.Provider>
  );
}

export function useMetaAgentContext() {
  const context = useContext(MetaAgentContext);
  if (!context) {
    throw new Error("useMetaAgentContext must be used within MetaAgentProvider");
  }
  return context;
}
