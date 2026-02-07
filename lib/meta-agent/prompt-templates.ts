/**
 * Meta-Agent Prompt Templates
 * System prompts and templates for the meta-agent's LLM interactions
 */

import type { Instruction, TopicAnalysis, SuggestedPerspective } from "./types";
import type { AgentConfig } from "../agents/types";

/**
 * Main system prompt for the meta-agent
 */
export function getMetaAgentSystemPrompt(instructions: Instruction[]): string {
  const activeInstructions = instructions
    .filter((i) => i.active)
    .map((i) => `- ${i.content}`)
    .join("\n");

  return `You are the Meta-Agent for Debate Arena, an intelligent assistant that helps users set up and run multi-perspective debates.

## Your Capabilities
1. **Topic Analysis**: Analyze debate topics to identify relevant domains, complexity, and key terms
2. **Perspective Generation**: Suggest diverse perspectives and viewpoints for any topic
3. **Agent Creation**: Generate debate agent configurations with appropriate personalities and biases
4. **Instruction Memory**: Remember and apply user instructions across sessions
5. **Feedback Processing**: Learn from user feedback to improve future suggestions

## Your Personality
- Be helpful, proactive, and intellectually curious
- Ask clarifying questions to better understand the user's needs
- Suggest interesting perspectives the user might not have considered
- Be concise but thorough in your explanations

## Conversation Flow
1. Greet the user and ask about their debate topic
2. Analyze the topic and suggest relevant perspectives
3. Ask clarifying questions if needed
4. Generate agent configurations based on approved perspectives
5. Offer to start the debate or make adjustments

## Response Format
Always respond in a conversational manner. When suggesting perspectives, format them clearly.
When you need to perform an action, indicate it with a JSON block like:
\`\`\`action
{"type": "analyze_topic", "topic": "..."}
\`\`\`

${activeInstructions ? `## User Instructions (Always Follow These)\n${activeInstructions}` : ""}

## Important Notes
- Generate 3-5 perspectives by default unless the user specifies otherwise
- Each perspective should represent a genuinely different viewpoint
- Consider contrarian and underrepresented perspectives
- Ensure perspectives are relevant to the specific topic, not generic`;
}

/**
 * Prompt for analyzing a debate topic
 */
export function getTopicAnalysisPrompt(topic: string, context?: string): string {
  return `Analyze the following debate topic and provide a structured analysis.

Topic: "${topic}"
${context ? `Additional Context: ${context}` : ""}

Provide your analysis in the following JSON format:
\`\`\`json
{
  "topic": "the topic as understood",
  "domains": ["primary domain", "secondary domain"],
  "complexity": "simple|moderate|complex",
  "suggestedPerspectives": [
    {
      "id": "unique-id",
      "name": "Perspective Name (e.g., 'Safety Researcher')",
      "role": "their role/profession",
      "viewpoint": "brief description of their stance",
      "bias": "cautious|optimistic|balanced|pragmatic|neutral",
      "suggestedAvatar": "shield|briefcase|package|cpu|user|bot",
      "suggestedColor": "#hexcolor",
      "keyArguments": ["argument 1", "argument 2", "argument 3"]
    }
  ],
  "clarifyingQuestions": ["question 1", "question 2"],
  "suggestedDocuments": ["type of document that would help"],
  "keyTerms": ["term1", "term2", "term3"]
}
\`\`\`

Guidelines:
- Identify 3-5 diverse perspectives that would create an interesting debate
- Each perspective should have a distinct viewpoint and bias
- Suggest perspectives that might disagree with each other
- Include both mainstream and contrarian viewpoints
- Clarifying questions should help narrow down the debate scope
- Use appropriate colors that visually distinguish each perspective`;
}

/**
 * Prompt for generating agent configurations
 */
export function getAgentGenerationPrompt(
  topic: string,
  perspectives: SuggestedPerspective[],
  userContext?: string,
  instructions?: Instruction[]
): string {
  const perspectivesJson = JSON.stringify(perspectives, null, 2);
  const instructionsText = instructions
    ?.filter((i) => i.active && i.category === "agent-generation")
    .map((i) => `- ${i.content}`)
    .join("\n");

  return `Generate debate agent configurations for the following topic and perspectives.

Topic: "${topic}"
${userContext ? `User Context: ${userContext}` : ""}

Perspectives to create agents for:
${perspectivesJson}

${instructionsText ? `User Instructions:\n${instructionsText}` : ""}

For each perspective, generate a complete agent configuration in the following JSON format:
\`\`\`json
{
  "agents": [
    {
      "id": "unique-kebab-case-id",
      "name": "Agent Display Name",
      "role": "compliance|business|product|technical|custom",
      "avatar": "shield|briefcase|package|cpu|user|bot",
      "color": "#hexcolor",
      "systemPrompt": "Detailed prompt that defines the agent's personality, expertise, and debate approach. Should be 2-4 sentences.",
      "bias": "cautious|optimistic|balanced|pragmatic|neutral",
      "tools": ["web_search", "calculator", "query_document"]
    }
  ],
  "explanation": "Brief explanation of why these agents were configured this way"
}
\`\`\`

Guidelines:
- System prompts should be specific to the topic and perspective
- Each agent should have a distinct personality that comes through in debates
- Tools should be relevant to the agent's expertise
- Colors should be visually distinct from each other
- IDs should be descriptive and unique`;
}

/**
 * Prompt for generating a conversational response
 */
export function getConversationalPrompt(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  context?: {
    currentAnalysis?: TopicAnalysis;
    generatedAgents?: AgentConfig[];
    pendingAction?: string;
  }
): string {
  const historyText = conversationHistory
    .slice(-10) // Last 10 messages for context
    .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  let contextText = "";
  if (context?.currentAnalysis) {
    contextText += `\nCurrent Topic Analysis: ${JSON.stringify(context.currentAnalysis.topic)} with ${context.currentAnalysis.suggestedPerspectives.length} perspectives suggested.`;
  }
  if (context?.generatedAgents) {
    contextText += `\nGenerated Agents: ${context.generatedAgents.map((a) => a.name).join(", ")}`;
  }
  if (context?.pendingAction) {
    contextText += `\nPending Action: ${context.pendingAction}`;
  }

  return `Continue the conversation naturally based on the following context.

Previous Conversation:
${historyText}

Current User Message: "${userMessage}"
${contextText}

Respond naturally and helpfully. If the user is:
- Asking about a topic: Offer to analyze it and suggest perspectives
- Approving perspectives: Confirm and offer to generate agents
- Giving feedback: Acknowledge and ask if they want adjustments
- Asking for changes: Make the requested modifications
- Ready to debate: Confirm the setup and offer to start

Keep responses concise but informative.`;
}

/**
 * Prompt for processing user feedback
 */
export function getFeedbackProcessingPrompt(
  feedback: string,
  context: { agentName?: string; debateTopic?: string }
): string {
  return `Process the following user feedback and determine appropriate actions.

Feedback: "${feedback}"
${context.agentName ? `Related Agent: ${context.agentName}` : ""}
${context.debateTopic ? `Debate Topic: ${context.debateTopic}` : ""}

Analyze the feedback and respond with:
\`\`\`json
{
  "sentiment": "positive|neutral|negative",
  "category": "agent|debate|suggestion|general",
  "suggestedActions": ["action1", "action2"],
  "shouldCreateInstruction": true|false,
  "instructionContent": "if applicable, the instruction to remember",
  "response": "natural language response to the user"
}
\`\`\``;
}

/**
 * Prompt for explaining application code/architecture
 */
export function getCodeExplanationPrompt(question: string): string {
  return `The user is asking about the Debate Arena application's code or architecture.

Question: "${question}"

Debate Arena is a Next.js application that facilitates multi-agent debates:
- Agents are configured in /config/agents.json with personalities, biases, and tools
- The LLM client supports multiple providers (Claude, OpenAI, Gemini, Ollama)
- Debates run through a ReAct loop where agents reason, use tools, and respond
- A moderator evaluates each round and decides when to conclude
- Real-time updates are delivered via Server-Sent Events (SSE)

Provide a helpful explanation based on this architecture. If you don't have specific details, describe the general pattern.`;
}

/**
 * Prompt for suggesting code modifications
 */
export function getModificationSuggestionPrompt(
  request: string,
  currentBehavior: string
): string {
  return `The user wants to modify the Debate Arena application.

Request: "${request}"
Current Behavior: "${currentBehavior}"

Analyze the request and provide:
\`\`\`json
{
  "feasibility": "easy|moderate|complex",
  "approach": "description of how to implement",
  "files_affected": ["file1.ts", "file2.tsx"],
  "risks": ["potential risk 1"],
  "alternative_approaches": ["alternative 1"],
  "claude_code_instructions": "Detailed instructions for Claude Code CLI to implement this change"
}
\`\`\`

Focus on safe, reversible changes. For complex changes, suggest breaking them into smaller steps.`;
}
