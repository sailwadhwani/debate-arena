/**
 * Tool Types for Debate Arena
 */

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      items?: { type: string };
    }>;
    required?: string[];
  };
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  success: boolean;
  result: string;
  error?: string;
}

export interface Tool {
  definition: ToolDefinition;
  execute(input: Record<string, unknown>, context?: ToolContext): Promise<ToolResult>;
}

export interface ToolContext {
  documentContent?: string;
  debateId?: string;
  agentId?: string;
}

export interface ToolRegistry {
  register(tool: Tool): void;
  get(name: string): Tool | undefined;
  getAll(): Tool[];
  getDefinitions(): ToolDefinition[];
}
