/**
 * Topic Analyzer
 * Analyzes debate topics and suggests relevant perspectives
 */

import { createLLMClientFromEnv } from "../llm/client";
import { getTopicAnalysisPrompt } from "./prompt-templates";
import type { TopicAnalysis, SuggestedPerspective, DomainType } from "./types";
import { generateId } from "./memory";

// Color palette for perspectives
const PERSPECTIVE_COLORS = [
  "#ff6b6b", // Red
  "#4ecdc4", // Teal
  "#45b7d1", // Blue
  "#96ceb4", // Green
  "#ffeaa7", // Yellow
  "#dfe6e9", // Gray
  "#a29bfe", // Purple
  "#fd79a8", // Pink
  "#00b894", // Emerald
  "#e17055", // Orange
];

/**
 * Analyze a debate topic using the LLM
 */
export async function analyzeTopic(
  topic: string,
  context?: string
): Promise<TopicAnalysis> {
  const client = await createLLMClientFromEnv();
  const prompt = getTopicAnalysisPrompt(topic, context);

  const response = await client.complete({
    userPrompt: prompt,
    systemPrompt:
      "You are an expert at analyzing debate topics and identifying diverse perspectives. Always respond with valid JSON.",
    maxTokens: 2000,
    temperature: 0.7,
  });

  // Extract JSON from the response
  const jsonMatch = response.content.match(/```json\n?([\s\S]*?)\n?```/);
  if (!jsonMatch) {
    // Try to parse the entire response as JSON
    try {
      const analysis = JSON.parse(response.content) as TopicAnalysis;
      return normalizeAnalysis(analysis, topic);
    } catch {
      // Fall back to default analysis
      return createDefaultAnalysis(topic);
    }
  }

  try {
    const analysis = JSON.parse(jsonMatch[1]) as TopicAnalysis;
    return normalizeAnalysis(analysis, topic);
  } catch {
    return createDefaultAnalysis(topic);
  }
}

/**
 * Normalize and validate the analysis
 */
function normalizeAnalysis(
  analysis: Partial<TopicAnalysis>,
  topic: string
): TopicAnalysis {
  // Ensure perspectives have unique IDs and colors
  const perspectives = (analysis.suggestedPerspectives || []).map(
    (p, index) => ({
      ...p,
      id: p.id || generateId(),
      suggestedColor: p.suggestedColor || PERSPECTIVE_COLORS[index % PERSPECTIVE_COLORS.length],
      suggestedAvatar: p.suggestedAvatar || "user",
      bias: p.bias || "balanced",
      keyArguments: p.keyArguments || [],
    })
  );

  return {
    topic: analysis.topic || topic,
    domains: (analysis.domains || ["general"]) as DomainType[],
    complexity: analysis.complexity || "moderate",
    suggestedPerspectives: perspectives,
    clarifyingQuestions: analysis.clarifyingQuestions || [],
    suggestedDocuments: analysis.suggestedDocuments,
    keyTerms: analysis.keyTerms || [],
  };
}

/**
 * Create a default analysis when LLM fails
 */
function createDefaultAnalysis(topic: string): TopicAnalysis {
  return {
    topic,
    domains: ["general"],
    complexity: "moderate",
    suggestedPerspectives: [
      {
        id: generateId(),
        name: "Proponent",
        role: "Advocate",
        viewpoint: "Supports the main premise of the topic",
        bias: "optimistic",
        suggestedAvatar: "user",
        suggestedColor: PERSPECTIVE_COLORS[0],
        keyArguments: ["Benefits outweigh risks", "Evidence supports this position"],
      },
      {
        id: generateId(),
        name: "Skeptic",
        role: "Critical Analyst",
        viewpoint: "Questions assumptions and seeks evidence",
        bias: "cautious",
        suggestedAvatar: "shield",
        suggestedColor: PERSPECTIVE_COLORS[1],
        keyArguments: ["More research needed", "Potential downsides exist"],
      },
      {
        id: generateId(),
        name: "Pragmatist",
        role: "Practical Implementer",
        viewpoint: "Focuses on practical implementation and trade-offs",
        bias: "balanced",
        suggestedAvatar: "briefcase",
        suggestedColor: PERSPECTIVE_COLORS[2],
        keyArguments: ["Implementation matters", "Balance is key"],
      },
    ],
    clarifyingQuestions: [
      "What specific aspect of this topic interests you most?",
      "Are you looking for a debate focused on theory or practical applications?",
    ],
    keyTerms: [],
  };
}

/**
 * Generate additional perspectives for a topic
 */
export async function generateMorePerspectives(
  topic: string,
  existingPerspectives: SuggestedPerspective[],
  count: number = 2
): Promise<SuggestedPerspective[]> {
  const client = await createLLMClientFromEnv();

  const existingNames = existingPerspectives.map((p) => p.name).join(", ");
  const usedColors = new Set(existingPerspectives.map((p) => p.suggestedColor));
  const availableColors = PERSPECTIVE_COLORS.filter((c) => !usedColors.has(c));

  const prompt = `Given the debate topic "${topic}" and existing perspectives (${existingNames}), suggest ${count} additional unique perspectives that would add value to the debate.

Requirements:
- Perspectives should be distinctly different from existing ones
- Include viewpoints that might be overlooked
- Consider contrarian or minority positions

Respond with JSON:
\`\`\`json
{
  "perspectives": [
    {
      "name": "Name",
      "role": "Role",
      "viewpoint": "Their stance",
      "bias": "cautious|optimistic|balanced|pragmatic|neutral",
      "suggestedAvatar": "shield|briefcase|package|cpu|user|bot",
      "keyArguments": ["arg1", "arg2"]
    }
  ]
}
\`\`\``;

  const response = await client.complete({
    userPrompt: prompt,
    systemPrompt: "You are an expert at identifying diverse debate perspectives. Respond with valid JSON.",
    maxTokens: 1000,
    temperature: 0.8,
  });

  try {
    const jsonMatch = response.content.match(/```json\n?([\s\S]*?)\n?```/);
    const json = jsonMatch ? jsonMatch[1] : response.content;
    const result = JSON.parse(json) as { perspectives: SuggestedPerspective[] };

    return result.perspectives.map((p, index) => ({
      ...p,
      id: generateId(),
      suggestedColor: availableColors[index] || PERSPECTIVE_COLORS[index],
      suggestedAvatar: p.suggestedAvatar || "user",
      bias: p.bias || "balanced",
      keyArguments: p.keyArguments || [],
    }));
  } catch {
    return [];
  }
}

/**
 * Refine perspectives based on user feedback
 */
export async function refinePerspectives(
  topic: string,
  perspectives: SuggestedPerspective[],
  feedback: string
): Promise<SuggestedPerspective[]> {
  const client = await createLLMClientFromEnv();

  const prompt = `Given the debate topic "${topic}" and the following perspectives:
${JSON.stringify(perspectives, null, 2)}

User feedback: "${feedback}"

Refine the perspectives based on the feedback. Respond with the updated perspectives in JSON:
\`\`\`json
{
  "perspectives": [...]
}
\`\`\``;

  const response = await client.complete({
    userPrompt: prompt,
    systemPrompt: "You are an expert at refining debate perspectives based on feedback. Respond with valid JSON.",
    maxTokens: 1500,
    temperature: 0.6,
  });

  try {
    const jsonMatch = response.content.match(/```json\n?([\s\S]*?)\n?```/);
    const json = jsonMatch ? jsonMatch[1] : response.content;
    const result = JSON.parse(json) as { perspectives: SuggestedPerspective[] };

    return result.perspectives.map((p, index) => ({
      ...p,
      id: p.id || generateId(),
      suggestedColor: p.suggestedColor || perspectives[index]?.suggestedColor || PERSPECTIVE_COLORS[index],
    }));
  } catch {
    return perspectives;
  }
}

/**
 * Suggest clarifying questions for a topic
 */
export async function suggestClarifyingQuestions(
  topic: string,
  answeredQuestions: string[] = []
): Promise<string[]> {
  const client = await createLLMClientFromEnv();

  const answeredText = answeredQuestions.length > 0
    ? `\nAlready answered: ${answeredQuestions.join("; ")}`
    : "";

  const prompt = `For the debate topic "${topic}", suggest 3 clarifying questions that would help narrow down the debate scope and make it more focused.${answeredText}

Respond with JSON:
\`\`\`json
{
  "questions": ["question1", "question2", "question3"]
}
\`\`\``;

  const response = await client.complete({
    userPrompt: prompt,
    systemPrompt: "You are an expert at asking clarifying questions. Respond with valid JSON.",
    maxTokens: 500,
    temperature: 0.7,
  });

  try {
    const jsonMatch = response.content.match(/```json\n?([\s\S]*?)\n?```/);
    const json = jsonMatch ? jsonMatch[1] : response.content;
    const result = JSON.parse(json) as { questions: string[] };
    return result.questions;
  } catch {
    return [
      "What specific aspect of this topic interests you most?",
      "What is the primary goal of this debate?",
      "Are there any perspectives you definitely want included?",
    ];
  }
}
