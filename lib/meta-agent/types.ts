/**
 * Meta-Agent Type Definitions
 * Types for the self-evolving agentic system
 */

import type { AgentConfig, AgentRole, AgentBias, AvatarType } from "../agents/types";

// ============================================
// Memory Types
// ============================================

export interface Instruction {
  id: string;
  content: string;
  category: "agent-generation" | "debate-setup" | "ui-preference" | "general";
  createdAt: string;
  active: boolean;
}

export interface UserPreferences {
  defaultAgentCount: number;
  preferredPerspectiveStyle: "diverse" | "balanced" | "contrarian";
  autoStartDebate: boolean;
  verboseMode: boolean;
}

export interface EvolutionEvent {
  id: string;
  type: "config-change" | "code-suggestion" | "agent-created" | "instruction-added";
  description: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export interface GeneratedAgent {
  id: string;
  config: AgentConfig;
  generatedFor: string; // Topic/context it was generated for
  createdAt: string;
  feedback?: AgentFeedback;
}

export interface AgentFeedback {
  quality: "excellent" | "good" | "adequate" | "poor";
  notes?: string;
  timestamp: string;
}

export interface ConversationRef {
  id: string;
  topic: string;
  startedAt: string;
  lastMessageAt: string;
  messageCount: number;
}

export interface FeedbackItem {
  id: string;
  type: "agent" | "debate" | "suggestion" | "general";
  targetId?: string;
  content: string;
  sentiment: "positive" | "neutral" | "negative";
  timestamp: string;
  processed: boolean;
}

export interface MetaAgentMemory {
  instructions: Instruction[];
  preferences: UserPreferences;
  evolutionHistory: EvolutionEvent[];
  generatedAgents: GeneratedAgent[];
  conversations: ConversationRef[];
  feedback: FeedbackItem[];
  lastUpdated: string;
}

// ============================================
// Conversation Types
// ============================================

export type MessageRole = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  metadata?: {
    perspectives?: SuggestedPerspective[];
    generatedAgents?: AgentConfig[];
    action?: MetaAgentAction;
    clarifyingQuestions?: string[];
  };
}

export interface Conversation {
  id: string;
  messages: ChatMessage[];
  topic?: string;
  status: "active" | "completed" | "archived";
  createdAt: string;
  updatedAt: string;
}

// ============================================
// Topic Analysis Types
// ============================================

export type DomainType =
  | "technology"
  | "ethics"
  | "business"
  | "science"
  | "politics"
  | "philosophy"
  | "health"
  | "environment"
  | "social"
  | "legal"
  | "economics"
  | "general";

export interface SuggestedPerspective {
  id: string;
  name: string;
  role: string;
  viewpoint: string;
  bias: AgentBias;
  suggestedAvatar: AvatarType;
  suggestedColor: string;
  keyArguments: string[];
}

export interface TopicAnalysis {
  topic: string;
  domains: DomainType[];
  complexity: "simple" | "moderate" | "complex";
  suggestedPerspectives: SuggestedPerspective[];
  clarifyingQuestions: string[];
  suggestedDocuments?: string[];
  keyTerms: string[];
}

// ============================================
// Agent Generation Types
// ============================================

export interface AgentGenerationRequest {
  topic: string;
  perspectives: SuggestedPerspective[];
  userContext?: string;
  instructions?: Instruction[];
}

export interface AgentGenerationResult {
  agents: AgentConfig[];
  explanation: string;
  suggestedModeratorPrompt?: string;
}

// ============================================
// Action Types
// ============================================

export type MetaAgentActionType =
  | "analyze_topic"
  | "suggest_perspectives"
  | "generate_agents"
  | "start_debate"
  | "save_instruction"
  | "modify_agent"
  | "provide_feedback"
  | "explain_code"
  | "suggest_modification";

export interface MetaAgentAction {
  type: MetaAgentActionType;
  payload: Record<string, unknown>;
  status: "pending" | "executing" | "completed" | "failed";
  result?: unknown;
  error?: string;
}

// ============================================
// API Types
// ============================================

export interface MetaAgentChatRequest {
  message: string;
  conversationId?: string;
}

export interface MetaAgentChatResponse {
  message: ChatMessage;
  conversationId: string;
  suggestedActions?: MetaAgentActionType[];
}

export interface MetaAgentAnalyzeRequest {
  topic: string;
  context?: string;
}

export interface MetaAgentAnalyzeResponse {
  analysis: TopicAnalysis;
}

export interface MetaAgentGenerateRequest {
  topic: string;
  perspectives: SuggestedPerspective[];
  saveToConfig?: boolean;
}

export interface MetaAgentGenerateResponse {
  agents: AgentConfig[];
  saved: boolean;
}

export interface MetaAgentInstructionRequest {
  action: "add" | "update" | "delete" | "list";
  instruction?: Partial<Instruction>;
  id?: string;
}

export interface MetaAgentInstructionResponse {
  instructions: Instruction[];
  message: string;
}

// ============================================
// Service Types
// ============================================

export interface MetaAgentContext {
  memory: MetaAgentMemory;
  currentConversation?: Conversation;
  recentAnalysis?: TopicAnalysis;
}

export interface MetaAgentServiceConfig {
  memoryPath: string;
  conversationsPath: string;
  maxConversationHistory: number;
}
