/**
 * Meta-Agent Service
 * Main orchestrator for the meta-agent system
 */

import { createLLMClientFromEnv } from "../llm/client";
import {
  loadMemory,
  saveMemory,
  createConversation,
  loadConversation,
  saveConversation,
  addMessageToConversation,
  addInstruction,
  addFeedback,
  addEvolutionEvent,
  generateId,
} from "./memory";
import { analyzeTopic, generateMorePerspectives, refinePerspectives } from "./topic-analyzer";
import { generateAgents, saveGeneratedAgents, modifyAgent } from "./agent-generator";
import {
  getMetaAgentSystemPrompt,
  getConversationalPrompt,
  getFeedbackProcessingPrompt,
} from "./prompt-templates";
import type {
  MetaAgentMemory,
  Conversation,
  ChatMessage,
  TopicAnalysis,
  SuggestedPerspective,
  MetaAgentAction,
  MetaAgentActionType,
  MetaAgentContext,
} from "./types";
import type { AgentConfig } from "../agents/types";

// In-memory cache for active sessions
const sessionCache = new Map<string, MetaAgentContext>();

/**
 * Initialize or get the meta-agent context for a conversation
 */
export async function getContext(conversationId?: string): Promise<MetaAgentContext> {
  if (conversationId && sessionCache.has(conversationId)) {
    return sessionCache.get(conversationId)!;
  }

  const memory = await loadMemory();
  let conversation: Conversation | undefined;

  if (conversationId) {
    conversation = (await loadConversation(conversationId)) || undefined;
  }

  if (!conversation) {
    conversation = await createConversation();
  }

  const context: MetaAgentContext = {
    memory,
    currentConversation: conversation,
  };

  sessionCache.set(conversation.id, context);
  return context;
}

/**
 * Update the cached context
 */
function updateContext(conversationId: string, updates: Partial<MetaAgentContext>): void {
  const existing = sessionCache.get(conversationId);
  if (existing) {
    sessionCache.set(conversationId, { ...existing, ...updates });
  }
}

/**
 * Process a user message and generate a response
 */
export async function processMessage(
  userMessage: string,
  conversationId?: string
): Promise<{ response: ChatMessage; conversationId: string; actions: MetaAgentAction[] }> {
  const context = await getContext(conversationId);
  const conversation = context.currentConversation!;

  // Add user message to conversation
  const userMsg = await addMessageToConversation(conversation.id, {
    role: "user",
    content: userMessage,
  });
  conversation.messages.push(userMsg);

  // Detect intent and execute actions
  const actions = await detectAndExecuteActions(userMessage, context);

  // Generate response
  const response = await generateResponse(userMessage, context, actions);

  // Add response to conversation
  const assistantMsg = await addMessageToConversation(conversation.id, {
    role: "assistant",
    content: response.content,
    metadata: response.metadata,
  });
  conversation.messages.push(assistantMsg);

  // Update context
  updateContext(conversation.id, { currentConversation: conversation });

  return {
    response: assistantMsg,
    conversationId: conversation.id,
    actions,
  };
}

/**
 * Detect user intent and execute corresponding actions
 */
async function detectAndExecuteActions(
  message: string,
  context: MetaAgentContext
): Promise<MetaAgentAction[]> {
  const actions: MetaAgentAction[] = [];
  const lowerMessage = message.toLowerCase();

  // Detect topic for analysis
  if (
    lowerMessage.includes("debate") ||
    lowerMessage.includes("discuss") ||
    lowerMessage.includes("topic") ||
    lowerMessage.includes("want to") ||
    (lowerMessage.includes("about") && !context.recentAnalysis)
  ) {
    const topicMatch = extractTopic(message);
    if (topicMatch) {
      const action = await executeAction("analyze_topic", { topic: topicMatch }, context);
      actions.push(action);
    }
  }

  // Detect approval of perspectives
  if (
    (lowerMessage.includes("looks good") ||
      lowerMessage.includes("sounds good") ||
      lowerMessage.includes("yes") ||
      lowerMessage.includes("proceed") ||
      lowerMessage.includes("generate") ||
      lowerMessage.includes("create agents")) &&
    context.recentAnalysis
  ) {
    const action = await executeAction(
      "generate_agents",
      {
        topic: context.recentAnalysis.topic,
        perspectives: context.recentAnalysis.suggestedPerspectives,
      },
      context
    );
    actions.push(action);
  }

  // Detect instruction
  if (
    lowerMessage.includes("always") ||
    lowerMessage.includes("remember") ||
    lowerMessage.includes("from now on")
  ) {
    const instruction = extractInstruction(message);
    if (instruction) {
      const action = await executeAction("save_instruction", { content: instruction }, context);
      actions.push(action);
    }
  }

  // Detect feedback
  if (
    lowerMessage.includes("feedback") ||
    lowerMessage.includes("didn't like") ||
    lowerMessage.includes("too") ||
    lowerMessage.includes("should be more") ||
    lowerMessage.includes("should be less")
  ) {
    const action = await executeAction("provide_feedback", { content: message }, context);
    actions.push(action);
  }

  return actions;
}

/**
 * Execute a specific action
 */
async function executeAction(
  type: MetaAgentActionType,
  payload: Record<string, unknown>,
  context: MetaAgentContext
): Promise<MetaAgentAction> {
  const action: MetaAgentAction = {
    type,
    payload,
    status: "executing",
  };

  try {
    switch (type) {
      case "analyze_topic": {
        const analysis = await analyzeTopic(payload.topic as string);
        action.result = analysis;
        updateContext(context.currentConversation!.id, { recentAnalysis: analysis });
        break;
      }

      case "generate_agents": {
        const result = await generateAgents({
          topic: payload.topic as string,
          perspectives: payload.perspectives as SuggestedPerspective[],
        });
        action.result = result;
        break;
      }

      case "save_instruction": {
        const instruction = await addInstruction(payload.content as string);
        action.result = instruction;
        break;
      }

      case "provide_feedback": {
        const feedback = await addFeedback({
          type: "general",
          content: payload.content as string,
          sentiment: detectSentiment(payload.content as string),
        });
        action.result = feedback;
        break;
      }

      case "start_debate": {
        // This would be handled by the UI
        action.result = { ready: true };
        break;
      }

      default:
        action.result = null;
    }

    action.status = "completed";
  } catch (error) {
    action.status = "failed";
    action.error = error instanceof Error ? error.message : "Unknown error";
  }

  return action;
}

/**
 * Generate a conversational response
 */
async function generateResponse(
  userMessage: string,
  context: MetaAgentContext,
  actions: MetaAgentAction[]
): Promise<{ content: string; metadata?: ChatMessage["metadata"] }> {
  const client = await createLLMClientFromEnv();
  const memory = context.memory;
  const conversation = context.currentConversation!;

  // Build context for response generation
  const systemPrompt = getMetaAgentSystemPrompt(memory.instructions);

  // Check for completed actions and build response accordingly
  const analyzeAction = actions.find((a) => a.type === "analyze_topic" && a.status === "completed");
  const generateAction = actions.find((a) => a.type === "generate_agents" && a.status === "completed");
  const instructionAction = actions.find((a) => a.type === "save_instruction" && a.status === "completed");

  let responseContent = "";
  const metadata: ChatMessage["metadata"] = {};

  if (analyzeAction?.result) {
    const analysis = analyzeAction.result as TopicAnalysis;
    metadata.perspectives = analysis.suggestedPerspectives;
    metadata.clarifyingQuestions = analysis.clarifyingQuestions;

    responseContent = formatAnalysisResponse(analysis);
  } else if (generateAction?.result) {
    const result = generateAction.result as { agents: AgentConfig[]; explanation: string };
    metadata.generatedAgents = result.agents;

    responseContent = formatAgentGenerationResponse(result);
  } else if (instructionAction?.result) {
    responseContent = `Got it! I've saved this instruction and will remember it for future conversations: "${(instructionAction.result as { content: string }).content}"`;
  } else {
    // Generate conversational response using LLM
    const conversationHistory = conversation.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const prompt = getConversationalPrompt(userMessage, conversationHistory, {
      currentAnalysis: context.recentAnalysis,
    });

    const response = await client.complete({
      userPrompt: prompt,
      systemPrompt,
      maxTokens: 1000,
      temperature: 0.7,
    });

    responseContent = response.content;
  }

  return { content: responseContent, metadata };
}

/**
 * Format topic analysis into a readable response
 */
function formatAnalysisResponse(analysis: TopicAnalysis): string {
  const perspectivesList = analysis.suggestedPerspectives
    .map((p, i) => `${i + 1}. **${p.name}** (${p.role}) - ${p.viewpoint}`)
    .join("\n");

  const questions = analysis.clarifyingQuestions.length > 0
    ? `\n\n**Some questions to consider:**\n${analysis.clarifyingQuestions.map((q) => `- ${q}`).join("\n")}`
    : "";

  return `I've analyzed your topic: **${analysis.topic}**

**Domains:** ${analysis.domains.join(", ")}
**Complexity:** ${analysis.complexity}

**Suggested Perspectives:**
${perspectivesList}
${questions}

Would you like me to generate debate agents based on these perspectives? Or would you like to adjust any of them?`;
}

/**
 * Format agent generation result into a readable response
 */
function formatAgentGenerationResponse(result: { agents: AgentConfig[]; explanation: string }): string {
  const agentsList = result.agents
    .map((a) => `- **${a.name}** (${a.bias} bias): ${a.systemPrompt.substring(0, 100)}...`)
    .join("\n");

  return `I've generated ${result.agents.length} debate agents:

${agentsList}

${result.explanation}

Would you like me to save these agents and start the debate? Or would you like to make any adjustments first?`;
}

/**
 * Extract topic from a message
 */
function extractTopic(message: string): string | null {
  // Common patterns for expressing debate topics
  const patterns = [
    /(?:debate|discuss|talk about|topic is|about)\s+["']?([^"'\n.?!]+)/i,
    /want to\s+(?:debate|discuss)\s+["']?([^"'\n.?!]+)/i,
    /interested in\s+["']?([^"'\n.?!]+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  // If no pattern matches but message is short, treat whole message as topic
  if (message.length < 100 && !message.includes("?")) {
    return message.trim();
  }

  return null;
}

/**
 * Extract instruction from a message
 */
function extractInstruction(message: string): string | null {
  const patterns = [
    /(?:always|remember to|from now on)[,:]?\s+(.+)/i,
    /remember[,:]?\s+(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) {
      return match[1].trim();
    }
  }

  return null;
}

/**
 * Detect sentiment of a message
 */
function detectSentiment(message: string): "positive" | "neutral" | "negative" {
  const lower = message.toLowerCase();

  const positiveWords = ["great", "good", "excellent", "love", "like", "amazing", "perfect"];
  const negativeWords = ["bad", "wrong", "hate", "dislike", "terrible", "poor", "didn't like"];

  const hasPositive = positiveWords.some((w) => lower.includes(w));
  const hasNegative = negativeWords.some((w) => lower.includes(w));

  if (hasPositive && !hasNegative) return "positive";
  if (hasNegative && !hasPositive) return "negative";
  return "neutral";
}

// ============================================
// Public API Functions
// ============================================

/**
 * Get the current memory state
 */
export async function getMemoryState(): Promise<MetaAgentMemory> {
  return loadMemory();
}

/**
 * Analyze a topic directly (without conversation)
 */
export async function analyzeTopicDirect(
  topic: string,
  context?: string
): Promise<TopicAnalysis> {
  return analyzeTopic(topic, context);
}

/**
 * Generate agents directly (without conversation)
 */
export async function generateAgentsDirect(
  topic: string,
  perspectives: SuggestedPerspective[],
  saveToConfig: boolean = false
): Promise<{ agents: AgentConfig[]; saved: boolean; errors?: string[] }> {
  const result = await generateAgents({ topic, perspectives });

  if (saveToConfig) {
    const { saved, errors } = await saveGeneratedAgents(result.agents, topic);
    return { agents: saved, saved: true, errors };
  }

  return { agents: result.agents, saved: false };
}

/**
 * Save agents to config
 */
export async function saveAgentsToConfig(
  agents: AgentConfig[],
  topic: string
): Promise<{ saved: AgentConfig[]; errors: string[] }> {
  return saveGeneratedAgents(agents, topic);
}

/**
 * Add more perspectives to an analysis
 */
export async function addMorePerspectives(
  topic: string,
  existingPerspectives: SuggestedPerspective[],
  count?: number
): Promise<SuggestedPerspective[]> {
  return generateMorePerspectives(topic, existingPerspectives, count);
}

/**
 * Refine perspectives based on feedback
 */
export async function refinePerspectivesWithFeedback(
  topic: string,
  perspectives: SuggestedPerspective[],
  feedback: string
): Promise<SuggestedPerspective[]> {
  return refinePerspectives(topic, perspectives, feedback);
}

/**
 * Get conversation history
 */
export async function getConversationHistory(
  conversationId: string
): Promise<Conversation | null> {
  return loadConversation(conversationId);
}

/**
 * Clear the session cache
 */
export function clearSessionCache(): void {
  sessionCache.clear();
}
