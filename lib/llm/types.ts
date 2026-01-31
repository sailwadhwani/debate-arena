/**
 * LLM Types for Debate Arena
 */

export type LLMProvider = "claude" | "openai" | "gemini" | "ollama";

export interface LLMClientConfig {
  provider: LLMProvider;
  apiKey?: string;
  model?: string;
  endpoint?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}

export interface LLMCompletionRequest {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

export interface LLMCompletionResponse {
  content: string;
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  model: string;
  finishReason: "stop" | "max_tokens" | "error";
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultMessage {
  toolCallId: string;
  toolName: string;
  result: string;
  isError?: boolean;
}

export interface ConversationMessage {
  role: "user" | "assistant" | "tool";
  content?: string;
  toolCalls?: ToolCall[];
  toolResult?: ToolResultMessage;
}

export interface LLMToolRequest {
  systemPrompt?: string;
  userPrompt: string;
  tools: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  toolResults?: ToolResultMessage[];
  messages?: ConversationMessage[];
}

export interface LLMToolResponse {
  content?: string;
  toolCalls?: ToolCall[];
  stopReason: "tool_use" | "end_turn" | "max_tokens";
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  model: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
    }>;
    required?: string[];
  };
}

export interface LLMClient {
  readonly provider: LLMProvider;
  readonly model: string;
  complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse>;
  completeWithTools(request: LLMToolRequest): Promise<LLMToolResponse>;
  healthCheck(): Promise<boolean>;
}
