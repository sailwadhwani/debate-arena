/**
 * LLM Client - Multi-provider support for Debate Arena
 */

import type {
  LLMClient,
  LLMClientConfig,
  LLMCompletionRequest,
  LLMCompletionResponse,
  LLMProvider,
  LLMToolRequest,
  LLMToolResponse,
  ToolCall,
  ToolDefinition,
} from "./types";

const DEFAULT_MODELS: Record<LLMProvider, string> = {
  claude: "claude-sonnet-4-20250514",
  openai: "gpt-4-turbo",
  gemini: "gemini-2.5-flash",
  ollama: "llama2",
};

// =============================================================================
// CLAUDE CLIENT
// =============================================================================

export class ClaudeClient implements LLMClient {
  readonly provider: LLMProvider = "claude";
  readonly model: string;
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly defaultTemperature: number;
  private readonly defaultMaxTokens: number;

  constructor(config: LLMClientConfig) {
    if (!config.apiKey) {
      throw new Error("Claude API key is required");
    }
    this.apiKey = config.apiKey;
    this.model = config.model || DEFAULT_MODELS.claude;
    this.endpoint = config.endpoint || "https://api.anthropic.com/v1/messages";
    this.defaultTemperature = config.defaultTemperature ?? 0.3;
    this.defaultMaxTokens = config.defaultMaxTokens ?? 4096;
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const temperature = request.temperature ?? this.defaultTemperature;
    const maxTokens = request.maxTokens ?? this.defaultMaxTokens;

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: maxTokens,
      temperature,
      messages: [{ role: "user", content: request.userPrompt }],
    };

    if (request.systemPrompt) {
      body.system = request.systemPrompt;
    }

    if (request.stopSequences?.length) {
      body.stop_sequences = request.stopSequences;
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.content
      .filter((block: { type: string }) => block.type === "text")
      .map((block: { text: string }) => block.text)
      .join("");

    return {
      content,
      tokensUsed: {
        input: data.usage?.input_tokens || 0,
        output: data.usage?.output_tokens || 0,
        total: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
      model: data.model,
      finishReason: data.stop_reason === "end_turn" ? "stop" : "max_tokens",
    };
  }

  async completeWithTools(request: LLMToolRequest): Promise<LLMToolResponse> {
    const temperature = request.temperature ?? this.defaultTemperature;
    const maxTokens = request.maxTokens ?? this.defaultMaxTokens;

    const messages: Array<{
      role: string;
      content: string | Array<{ type: string; tool_use_id?: string; content?: string; id?: string; name?: string; input?: unknown; text?: string }>;
    }> = [];

    // Add previous messages
    if (request.messages) {
      for (const msg of request.messages) {
        if (msg.role === "user") {
          messages.push({ role: "user", content: msg.content || "" });
        } else if (msg.role === "assistant") {
          if (msg.toolCalls && msg.toolCalls.length > 0) {
            const content: Array<{ type: string; id?: string; name?: string; input?: unknown; text?: string }> = [];
            if (msg.content) {
              content.push({ type: "text", text: msg.content });
            }
            for (const tc of msg.toolCalls) {
              content.push({ type: "tool_use", id: tc.id, name: tc.name, input: tc.input });
            }
            messages.push({ role: "assistant", content });
          } else {
            messages.push({ role: "assistant", content: msg.content || "" });
          }
        } else if (msg.role === "tool" && msg.toolResult) {
          messages.push({
            role: "user",
            content: [{ type: "tool_result", tool_use_id: msg.toolResult.toolCallId, content: msg.toolResult.result }],
          });
        }
      }
    }

    // Add tool results
    if (request.toolResults && request.toolResults.length > 0) {
      const toolResultContent: Array<{ type: string; tool_use_id: string; content: string }> = [];
      for (const tr of request.toolResults) {
        toolResultContent.push({ type: "tool_result", tool_use_id: tr.toolCallId, content: tr.result });
      }
      messages.push({ role: "user", content: toolResultContent });
    }

    if (messages.length === 0 || (!request.toolResults && !request.messages)) {
      messages.push({ role: "user", content: request.userPrompt });
    }

    const tools = request.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: {
        type: "object",
        properties: tool.inputSchema.properties,
        required: tool.inputSchema.required || [],
      },
    }));

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: maxTokens,
      temperature,
      messages,
      tools,
    };

    if (request.systemPrompt) {
      body.system = request.systemPrompt;
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Claude API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    let content: string | undefined;
    const toolCalls: ToolCall[] = [];

    for (const block of data.content || []) {
      if (block.type === "text") {
        content = (content || "") + block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({ id: block.id, name: block.name, input: block.input });
      }
    }

    let stopReason: LLMToolResponse["stopReason"] = "end_turn";
    if (data.stop_reason === "tool_use" || toolCalls.length > 0) {
      stopReason = "tool_use";
    } else if (data.stop_reason === "max_tokens") {
      stopReason = "max_tokens";
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      stopReason,
      tokensUsed: {
        input: data.usage?.input_tokens || 0,
        output: data.usage?.output_tokens || 0,
        total: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
      },
      model: data.model,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.complete({ userPrompt: "Say 'ok'", maxTokens: 10 });
      return true;
    } catch {
      return false;
    }
  }
}

// =============================================================================
// OPENAI CLIENT
// =============================================================================

export class OpenAIClient implements LLMClient {
  readonly provider: LLMProvider = "openai";
  readonly model: string;
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly defaultTemperature: number;
  private readonly defaultMaxTokens: number;

  constructor(config: LLMClientConfig) {
    if (!config.apiKey) {
      throw new Error("OpenAI API key is required");
    }
    this.apiKey = config.apiKey;
    this.model = config.model || DEFAULT_MODELS.openai;
    this.endpoint = config.endpoint || "https://api.openai.com/v1/chat/completions";
    this.defaultTemperature = config.defaultTemperature ?? 0.3;
    this.defaultMaxTokens = config.defaultMaxTokens ?? 4096;
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const temperature = request.temperature ?? this.defaultTemperature;
    const maxTokens = request.maxTokens ?? this.defaultMaxTokens;

    const messages: Array<{ role: string; content: string }> = [];
    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }
    messages.push({ role: "user", content: request.userPrompt });

    const body: Record<string, unknown> = {
      model: this.model,
      max_tokens: maxTokens,
      temperature,
      messages,
    };

    if (request.stopSequences?.length) {
      body.stop = request.stopSequences;
    }

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    return {
      content: choice?.message?.content || "",
      tokensUsed: {
        input: data.usage?.prompt_tokens || 0,
        output: data.usage?.completion_tokens || 0,
        total: data.usage?.total_tokens || 0,
      },
      model: data.model,
      finishReason: choice?.finish_reason === "stop" ? "stop" : "max_tokens",
    };
  }

  async completeWithTools(request: LLMToolRequest): Promise<LLMToolResponse> {
    const temperature = request.temperature ?? this.defaultTemperature;
    const maxTokens = request.maxTokens ?? this.defaultMaxTokens;

    const messages: Array<{ role: string; content?: string; tool_calls?: unknown[]; tool_call_id?: string }> = [];

    if (request.systemPrompt) {
      messages.push({ role: "system", content: request.systemPrompt });
    }

    if (request.messages) {
      for (const msg of request.messages) {
        if (msg.role === "user") {
          messages.push({ role: "user", content: msg.content || "" });
        } else if (msg.role === "assistant") {
          if (msg.toolCalls && msg.toolCalls.length > 0) {
            messages.push({
              role: "assistant",
              content: msg.content || undefined,
              tool_calls: msg.toolCalls.map((tc) => ({
                id: tc.id,
                type: "function",
                function: { name: tc.name, arguments: JSON.stringify(tc.input) },
              })),
            });
          } else {
            messages.push({ role: "assistant", content: msg.content || "" });
          }
        } else if (msg.role === "tool" && msg.toolResult) {
          messages.push({ role: "tool", tool_call_id: msg.toolResult.toolCallId, content: msg.toolResult.result });
        }
      }
    }

    if (request.toolResults && request.toolResults.length > 0) {
      for (const tr of request.toolResults) {
        messages.push({ role: "tool", tool_call_id: tr.toolCallId, content: tr.result });
      }
    }

    if (messages.filter((m) => m.role === "user").length === 0) {
      messages.push({ role: "user", content: request.userPrompt });
    }

    const tools = request.tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: {
          type: "object",
          properties: tool.inputSchema.properties,
          required: tool.inputSchema.required || [],
        },
      },
    }));

    const body: Record<string, unknown> = { model: this.model, max_tokens: maxTokens, temperature, messages, tools };

    const response = await fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    const content = choice?.message?.content || undefined;
    const toolCalls: ToolCall[] = [];

    if (choice?.message?.tool_calls) {
      for (const tc of choice.message.tool_calls) {
        if (tc.type === "function") {
          toolCalls.push({ id: tc.id, name: tc.function.name, input: JSON.parse(tc.function.arguments || "{}") });
        }
      }
    }

    let stopReason: LLMToolResponse["stopReason"] = "end_turn";
    if (choice?.finish_reason === "tool_calls" || toolCalls.length > 0) {
      stopReason = "tool_use";
    } else if (choice?.finish_reason === "length") {
      stopReason = "max_tokens";
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      stopReason,
      tokensUsed: {
        input: data.usage?.prompt_tokens || 0,
        output: data.usage?.completion_tokens || 0,
        total: data.usage?.total_tokens || 0,
      },
      model: data.model,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.complete({ userPrompt: "Say 'ok'", maxTokens: 10 });
      return true;
    } catch {
      return false;
    }
  }
}

// =============================================================================
// GEMINI CLIENT
// =============================================================================

export class GeminiClient implements LLMClient {
  readonly provider: LLMProvider = "gemini";
  readonly model: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly defaultTemperature: number;
  private readonly defaultMaxTokens: number;

  constructor(config: LLMClientConfig) {
    if (!config.apiKey) {
      throw new Error("Google API key is required");
    }
    this.apiKey = config.apiKey;
    this.model = config.model || DEFAULT_MODELS.gemini;
    this.baseUrl = config.endpoint || "https://generativelanguage.googleapis.com/v1beta";
    this.defaultTemperature = config.defaultTemperature ?? 0.3;
    this.defaultMaxTokens = config.defaultMaxTokens ?? 4096;
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const temperature = request.temperature ?? this.defaultTemperature;
    const maxTokens = request.maxTokens ?? this.defaultMaxTokens;

    let userContent = request.userPrompt;
    if (request.systemPrompt) {
      userContent = `System Instructions: ${request.systemPrompt}\n\nUser Request: ${request.userPrompt}`;
    }

    const body = {
      contents: [{ role: "user", parts: [{ text: userContent }] }],
      generationConfig: { temperature, maxOutputTokens: maxTokens, stopSequences: request.stopSequences },
    };

    const endpoint = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const content = candidate?.content?.parts?.[0]?.text || "";

    return {
      content,
      tokensUsed: {
        input: data.usageMetadata?.promptTokenCount || 0,
        output: data.usageMetadata?.candidatesTokenCount || 0,
        total: data.usageMetadata?.totalTokenCount || 0,
      },
      model: this.model,
      finishReason: candidate?.finishReason === "STOP" ? "stop" : "max_tokens",
    };
  }

  async completeWithTools(request: LLMToolRequest): Promise<LLMToolResponse> {
    const temperature = request.temperature ?? this.defaultTemperature;
    const maxTokens = request.maxTokens ?? this.defaultMaxTokens;

    const contents: Array<{ role: string; parts: Array<{ text?: string; functionCall?: unknown; functionResponse?: unknown }> }> = [];

    if (request.messages) {
      for (const msg of request.messages) {
        if (msg.role === "user") {
          contents.push({ role: "user", parts: [{ text: msg.content || "" }] });
        } else if (msg.role === "assistant") {
          if (msg.toolCalls && msg.toolCalls.length > 0) {
            const parts: Array<{ text?: string; functionCall?: unknown }> = [];
            if (msg.content) parts.push({ text: msg.content });
            for (const tc of msg.toolCalls) {
              parts.push({ functionCall: { name: tc.name, args: tc.input } });
            }
            contents.push({ role: "model", parts });
          } else {
            contents.push({ role: "model", parts: [{ text: msg.content || "" }] });
          }
        } else if (msg.role === "tool" && msg.toolResult) {
          contents.push({
            role: "function",
            parts: [{ functionResponse: { name: msg.toolResult.toolName, response: { result: msg.toolResult.result } } }],
          });
        }
      }
    }

    if (request.toolResults && request.toolResults.length > 0) {
      for (const tr of request.toolResults) {
        contents.push({
          role: "function",
          parts: [{ functionResponse: { name: tr.toolName, response: { result: tr.result } } }],
        });
      }
    }

    if (contents.length === 0) {
      contents.push({ role: "user", parts: [{ text: request.userPrompt }] });
    }

    const tools = [{
      functionDeclarations: request.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: { type: "object", properties: tool.inputSchema.properties, required: tool.inputSchema.required || [] },
      })),
    }];

    const body: Record<string, unknown> = {
      contents,
      tools,
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    };

    if (request.systemPrompt) {
      body.systemInstruction = { parts: [{ text: request.systemPrompt }] };
    }

    const endpoint = `${this.baseUrl}/models/${this.model}:generateContent?key=${this.apiKey}`;

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];

    let content: string | undefined;
    const toolCalls: ToolCall[] = [];

    if (candidate?.content?.parts) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          content = (content || "") + part.text;
        } else if (part.functionCall) {
          toolCalls.push({
            id: `gemini-${Date.now()}-${toolCalls.length}`,
            name: part.functionCall.name,
            input: part.functionCall.args as Record<string, unknown>,
          });
        }
      }
    }

    let stopReason: LLMToolResponse["stopReason"] = "end_turn";
    if (toolCalls.length > 0) {
      stopReason = "tool_use";
    } else if (candidate?.finishReason === "MAX_TOKENS") {
      stopReason = "max_tokens";
    }

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      stopReason,
      tokensUsed: {
        input: data.usageMetadata?.promptTokenCount || 0,
        output: data.usageMetadata?.candidatesTokenCount || 0,
        total: data.usageMetadata?.totalTokenCount || 0,
      },
      model: this.model,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.complete({ userPrompt: "Say 'ok'", maxTokens: 10 });
      return true;
    } catch {
      return false;
    }
  }
}

// =============================================================================
// OLLAMA CLIENT
// =============================================================================

export class OllamaClient implements LLMClient {
  readonly provider: LLMProvider = "ollama";
  readonly model: string;
  private readonly baseUrl: string;
  private readonly defaultTemperature: number;
  private readonly defaultMaxTokens: number;

  constructor(config: LLMClientConfig) {
    this.model = config.model || DEFAULT_MODELS.ollama;
    this.baseUrl = config.endpoint || "http://localhost:11434";
    this.defaultTemperature = config.defaultTemperature ?? 0.3;
    this.defaultMaxTokens = config.defaultMaxTokens ?? 4096;
  }

  async complete(request: LLMCompletionRequest): Promise<LLMCompletionResponse> {
    const temperature = request.temperature ?? this.defaultTemperature;
    const maxTokens = request.maxTokens ?? this.defaultMaxTokens;

    let prompt = request.userPrompt;
    if (request.systemPrompt) {
      prompt = `System: ${request.systemPrompt}\n\nUser: ${request.userPrompt}`;
    }

    const body = {
      model: this.model,
      prompt,
      stream: false,
      options: { temperature, num_predict: maxTokens, stop: request.stopSequences },
    };

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Ollama API error: ${response.status} - ${error}`);
    }

    const data = await response.json();

    return {
      content: data.response || "",
      tokensUsed: {
        input: data.prompt_eval_count || 0,
        output: data.eval_count || 0,
        total: (data.prompt_eval_count || 0) + (data.eval_count || 0),
      },
      model: this.model,
      finishReason: data.done ? "stop" : "max_tokens",
    };
  }

  async completeWithTools(request: LLMToolRequest): Promise<LLMToolResponse> {
    // Ollama uses structured prompting for tool use
    const toolDescriptions = request.tools
      .map((tool) => {
        const params = Object.entries(tool.inputSchema.properties)
          .map(([name, schema]) => `  - ${name} (${schema.type}): ${schema.description}`)
          .join("\n");
        return `### ${tool.name}\n${tool.description}\nParameters:\n${params}`;
      })
      .join("\n\n");

    let conversationHistory = "";
    if (request.messages) {
      for (const msg of request.messages) {
        if (msg.role === "user") {
          conversationHistory += `User: ${msg.content}\n\n`;
        } else if (msg.role === "assistant") {
          if (msg.toolCalls && msg.toolCalls.length > 0) {
            conversationHistory += `Assistant: I'll use these tools:\n`;
            for (const tc of msg.toolCalls) {
              conversationHistory += `TOOL_CALL: ${tc.name}(${JSON.stringify(tc.input)})\n`;
            }
          } else if (msg.content) {
            conversationHistory += `Assistant: ${msg.content}\n\n`;
          }
        } else if (msg.role === "tool" && msg.toolResult) {
          conversationHistory += `Tool Result (${msg.toolResult.toolName}): ${msg.toolResult.result}\n\n`;
        }
      }
    }

    if (request.toolResults && request.toolResults.length > 0) {
      for (const tr of request.toolResults) {
        conversationHistory += `Tool Result (${tr.toolName}): ${tr.result}\n\n`;
      }
    }

    const systemPrompt = `${request.systemPrompt || "You are a helpful assistant."}

You have access to the following tools:

${toolDescriptions}

When you need to use a tool, respond with EXACTLY this format on a new line:
TOOL_CALL: tool_name({"param": "value"})

When you have enough information, respond normally without any TOOL_CALL.`;

    const userPrompt = conversationHistory ? `${conversationHistory}User: ${request.userPrompt}` : request.userPrompt;

    const response = await this.complete({ systemPrompt, userPrompt });

    const toolCalls: ToolCall[] = [];
    let content = response.content;
    const toolCallPattern = /TOOL_CALL:\s*(\w+)\((\{[^}]+\})\)/g;
    let match;

    while ((match = toolCallPattern.exec(response.content)) !== null) {
      try {
        const toolName = match[1];
        const toolInput = JSON.parse(match[2]);
        if (request.tools.some((t) => t.name === toolName)) {
          toolCalls.push({ id: `ollama-${Date.now()}-${toolCalls.length}`, name: toolName, input: toolInput });
        }
      } catch {
        // Skip invalid tool calls
      }
    }

    if (toolCalls.length > 0) {
      content = response.content.replace(toolCallPattern, "").trim();
    }

    return {
      content: content || undefined,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      stopReason: toolCalls.length > 0 ? "tool_use" : "end_turn",
      tokensUsed: response.tokensUsed,
      model: response.model,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

// =============================================================================
// CLIENT FACTORY
// =============================================================================

import { promises as fs } from "fs";
import path from "path";

// Cache for LLM config
let cachedLLMConfig: LLMConfigFile | null = null;

interface LLMConfigFile {
  providers: {
    claude: { apiKey?: string; defaultModel: string; enabled: boolean };
    openai: { apiKey?: string; defaultModel: string; enabled: boolean };
    gemini: { apiKey?: string; defaultModel: string; enabled: boolean };
    ollama: { endpoint?: string; defaultModel: string; enabled: boolean };
  };
  defaults: {
    provider: string;
    temperature: number;
    maxTokens: number;
  };
}

async function loadLLMConfig(): Promise<LLMConfigFile | null> {
  if (cachedLLMConfig) return cachedLLMConfig;

  try {
    const configPath = path.join(process.cwd(), "config", "llm.json");
    const data = await fs.readFile(configPath, "utf-8");
    cachedLLMConfig = JSON.parse(data);
    return cachedLLMConfig;
  } catch {
    return null;
  }
}

// Sync version for constructor use
function loadLLMConfigSync(): LLMConfigFile | null {
  if (cachedLLMConfig) return cachedLLMConfig;

  try {
    const configPath = path.join(process.cwd(), "config", "llm.json");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const data = require("fs").readFileSync(configPath, "utf-8");
    cachedLLMConfig = JSON.parse(data);
    return cachedLLMConfig;
  } catch {
    return null;
  }
}

export function createLLMClient(config: LLMClientConfig): LLMClient {
  switch (config.provider) {
    case "claude":
      return new ClaudeClient(config);
    case "openai":
      return new OpenAIClient(config);
    case "gemini":
      return new GeminiClient(config);
    case "ollama":
      return new OllamaClient(config);
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}

export function createLLMClientFromEnv(providerOverride?: LLMProvider, modelOverride?: string): LLMClient {
  // Load config from llm.json
  const llmConfig = loadLLMConfigSync();

  // Determine provider - use override, or default from config, or fallback to claude
  const provider: LLMProvider = providerOverride ||
    (llmConfig?.defaults?.provider as LLMProvider) ||
    "claude";

  const apiKeyEnvMap: Record<LLMProvider, string> = {
    claude: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
    gemini: "GOOGLE_AI_API_KEY",
    ollama: "",
  };

  // Get API key from env
  const apiKey = apiKeyEnvMap[provider] ? process.env[apiKeyEnvMap[provider]] : undefined;

  // Get model from override, or provider-specific config, or default
  let model = modelOverride;
  let endpoint: string | undefined;
  let defaultTemperature = llmConfig?.defaults?.temperature;
  let defaultMaxTokens = llmConfig?.defaults?.maxTokens;

  if (llmConfig?.providers) {
    const providerConfig = llmConfig.providers[provider];
    if (providerConfig) {
      if (!model) {
        model = providerConfig.defaultModel;
      }
      if (provider === "ollama" && "endpoint" in providerConfig) {
        endpoint = providerConfig.endpoint;
      }
    }
  }

  return createLLMClient({
    provider,
    apiKey,
    model,
    endpoint,
    defaultTemperature,
    defaultMaxTokens,
  });
}

// Export for testing
export { loadLLMConfig };
