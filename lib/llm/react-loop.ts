/**
 * ReAct (Reasoning + Acting) Loop Implementation
 *
 * Implements the ReAct pattern for agent reasoning:
 * 1. Think - Reason about the current situation
 * 2. Act - Choose and execute a tool
 * 3. Observe - Process the tool result
 * 4. Repeat until ready to respond
 */

import type { LLMClient, ToolDefinition, ConversationMessage, ToolCall } from "./types";
import type { ToolContext } from "../tools/types";
import { toolRegistry } from "../tools/registry";

export interface ReActStep {
  type: "thinking" | "acting" | "observing";
  content: string;
  toolCall?: { name: string; input: Record<string, unknown> };
  toolResult?: string;
  timestamp: Date;
}

export interface ReActResult {
  steps: ReActStep[];
  finalResponse: string;
  toolsUsed: string[];
  totalTokens: number;
}

export interface ReActConfig {
  maxIterations?: number;
  systemPrompt?: string;
  tools?: ToolDefinition[];
  toolContext?: ToolContext;
  onStep?: (step: ReActStep) => void;
}

const DEFAULT_REACT_SYSTEM = `You are an intelligent agent that uses the ReAct (Reasoning and Acting) approach.

For each response, follow this pattern:
1. THINK: Analyze the situation and decide what to do next
2. ACT: If you need more information, use a tool. Otherwise, provide your final response.

When you have gathered enough information, provide a clear, well-reasoned response.`;

/**
 * Execute a ReAct loop with the given LLM client
 */
export async function executeReActLoop(
  client: LLMClient,
  userPrompt: string,
  config: ReActConfig = {}
): Promise<ReActResult> {
  const {
    maxIterations = 5,
    systemPrompt = DEFAULT_REACT_SYSTEM,
    tools = toolRegistry.getDefinitions(),
    toolContext,
    onStep,
  } = config;

  const steps: ReActStep[] = [];
  const toolsUsed: string[] = [];
  const messages: ConversationMessage[] = [];
  let totalTokens = 0;
  let iteration = 0;

  // Add initial user message
  messages.push({ role: "user", content: userPrompt });

  while (iteration < maxIterations) {
    iteration++;

    // Get LLM response with tools
    const response = await client.completeWithTools({
      systemPrompt,
      userPrompt: iteration === 1 ? userPrompt : "",
      tools,
      messages: iteration > 1 ? messages : undefined,
    });

    totalTokens += response.tokensUsed.total;

    // If we got text content, add a thinking step
    if (response.content) {
      const thinkingStep: ReActStep = {
        type: "thinking",
        content: response.content,
        timestamp: new Date(),
      };
      steps.push(thinkingStep);
      onStep?.(thinkingStep);
    }

    // If no tool calls, we're done
    if (response.stopReason === "end_turn" || !response.toolCalls || response.toolCalls.length === 0) {
      return {
        steps,
        finalResponse: response.content || "I could not generate a response.",
        toolsUsed: [...new Set(toolsUsed)],
        totalTokens,
      };
    }

    // Process tool calls
    const assistantToolCalls: ToolCall[] = response.toolCalls;

    // Add assistant message with tool calls
    messages.push({
      role: "assistant",
      content: response.content,
      toolCalls: assistantToolCalls,
    });

    // Execute each tool call
    for (const toolCall of assistantToolCalls) {
      // Add acting step
      const actingStep: ReActStep = {
        type: "acting",
        content: `Using tool: ${toolCall.name}`,
        toolCall: { name: toolCall.name, input: toolCall.input },
        timestamp: new Date(),
      };
      steps.push(actingStep);
      onStep?.(actingStep);

      // Execute the tool
      const tool = toolRegistry.get(toolCall.name);
      let result: string;

      if (tool) {
        toolsUsed.push(toolCall.name);
        const toolResult = await tool.execute(toolCall.input, toolContext);
        result = toolResult.success ? toolResult.result : `Error: ${toolResult.error}`;
      } else {
        result = `Error: Unknown tool "${toolCall.name}"`;
      }

      // Add observing step
      const observingStep: ReActStep = {
        type: "observing",
        content: result,
        toolResult: result,
        timestamp: new Date(),
      };
      steps.push(observingStep);
      onStep?.(observingStep);

      // Add tool result to messages
      messages.push({
        role: "tool",
        toolResult: {
          toolCallId: toolCall.id,
          toolName: toolCall.name,
          result,
        },
      });
    }
  }

  // Max iterations reached
  return {
    steps,
    finalResponse: "I reached the maximum number of reasoning steps. Here is my best assessment based on the information gathered.",
    toolsUsed: [...new Set(toolsUsed)],
    totalTokens,
  };
}

/**
 * Execute a simpler single-turn tool use (no ReAct loop)
 */
export async function executeSingleToolUse(
  client: LLMClient,
  userPrompt: string,
  tools: ToolDefinition[],
  toolContext?: ToolContext
): Promise<{ response: string; toolsUsed: string[] }> {
  const response = await client.completeWithTools({
    userPrompt,
    tools,
  });

  if (!response.toolCalls || response.toolCalls.length === 0) {
    return { response: response.content || "", toolsUsed: [] };
  }

  // Execute tool calls and continue conversation
  const toolsUsed: string[] = [];
  const results: string[] = [];

  for (const toolCall of response.toolCalls) {
    const tool = toolRegistry.get(toolCall.name);
    if (tool) {
      toolsUsed.push(toolCall.name);
      const result = await tool.execute(toolCall.input, toolContext);
      results.push(`${toolCall.name}: ${result.success ? result.result : result.error}`);
    }
  }

  // Get final response with tool results
  const finalResponse = await client.completeWithTools({
    userPrompt,
    tools,
    toolResults: response.toolCalls.map((tc, i) => ({
      toolCallId: tc.id,
      toolName: tc.name,
      result: results[i] || "No result",
    })),
  });

  return {
    response: finalResponse.content || "",
    toolsUsed,
  };
}
