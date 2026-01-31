/**
 * Agent Types for Debate Arena
 */

import type { LLMProvider } from "../llm/types";

export type AgentRole = "compliance" | "business" | "product" | "technical" | "custom";
export type AgentBias = "cautious" | "optimistic" | "balanced" | "pragmatic" | "neutral";
export type AvatarType = "shield" | "briefcase" | "package" | "cpu" | "user" | "bot";

export interface AgentLLMConfig {
  provider?: LLMProvider;
  model?: string;
  temperature?: number;
}

export interface AgentConfig {
  id: string;
  name: string;
  role: AgentRole;
  avatar: AvatarType;
  color: string;
  systemPrompt: string;
  bias: AgentBias;
  tools: string[];
  llm?: AgentLLMConfig;
}

export interface ModeratorConfig {
  id: string;
  name: string;
  systemPrompt: string;
  maxRounds: number;
  llm?: AgentLLMConfig;
}

export interface AgentsConfig {
  agents: AgentConfig[];
  moderator: ModeratorConfig;
}

// Debate State Types
export type DebateStatus = "idle" | "loading" | "debating" | "concluding" | "complete" | "error";

export interface DebateArgument {
  id: string;
  agentId: string;
  agentName: string;
  agentColor: string;
  round: number;
  content: string;
  score?: number;
  confidence?: number;
  toolsUsed?: string[];
  timestamp: Date;
}

export interface ModeratorStep {
  type: "thinking" | "acting" | "observing" | "decision";
  content: string;
  toolCall?: { name: string; input: Record<string, unknown> };
  toolResult?: string;
  decision?: "continue" | "conclude";
  timestamp: Date;
}

export interface DebateRound {
  number: number;
  arguments: DebateArgument[];
  moderatorSteps: ModeratorStep[];
  decision?: "continue" | "conclude";
}

export interface DebateSummary {
  consensus: number; // 0-100
  keyAgreements: string[];
  keyDisagreements: string[];
  recommendation: string;
  reasoning: string;
}

export interface DebateState {
  id: string;
  status: DebateStatus;
  task: string;
  documentContent?: string;
  documentName?: string;
  activeAgents: string[];
  rounds: DebateRound[];
  currentRound: number;
  speakingAgent?: string;
  summary?: DebateSummary;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
}

// Event Types for SSE
export type DebateEventType =
  | "debate_started"
  | "round_started"
  | "agent_thinking"
  | "agent_tool_use"
  | "agent_argument"
  | "moderator_step"
  | "round_complete"
  | "debate_complete"
  | "debate_error";

export interface DebateEvent {
  type: DebateEventType;
  timestamp: Date;
  data: {
    debateId: string;
    round?: number;
    agentId?: string;
    agentName?: string;
    argument?: DebateArgument;
    moderatorStep?: ModeratorStep;
    summary?: DebateSummary;
    error?: string;
    [key: string]: unknown;
  };
}

// ReAct Types
export interface ReActStep {
  thought: string;
  action?: {
    tool: string;
    input: Record<string, unknown>;
  };
  observation?: string;
  response?: string;
}

export interface ReActResult {
  steps: ReActStep[];
  finalResponse: string;
  toolsUsed: string[];
}
