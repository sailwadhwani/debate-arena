/**
 * Meta-Agent Persistent Memory System
 * Handles reading/writing memory and conversations to JSON files
 */

import { promises as fs } from "fs";
import path from "path";
import type {
  MetaAgentMemory,
  Conversation,
  Instruction,
  UserPreferences,
  EvolutionEvent,
  GeneratedAgent,
  FeedbackItem,
  ConversationRef,
  ChatMessage,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data", "meta-agent");
const MEMORY_FILE = path.join(DATA_DIR, "memory.json");
const CONVERSATIONS_DIR = path.join(DATA_DIR, "conversations");

// Default memory structure
const DEFAULT_MEMORY: MetaAgentMemory = {
  instructions: [],
  preferences: {
    defaultAgentCount: 3,
    preferredPerspectiveStyle: "diverse",
    autoStartDebate: false,
    verboseMode: false,
  },
  evolutionHistory: [],
  generatedAgents: [],
  conversations: [],
  feedback: [],
  lastUpdated: new Date().toISOString(),
};

/**
 * Ensures the data directories exist
 */
async function ensureDirectories(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(CONVERSATIONS_DIR, { recursive: true });
}

/**
 * Generates a unique ID
 */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================
// Memory Operations
// ============================================

/**
 * Load the meta-agent memory from disk
 */
export async function loadMemory(): Promise<MetaAgentMemory> {
  try {
    await ensureDirectories();
    const data = await fs.readFile(MEMORY_FILE, "utf-8");
    const memory = JSON.parse(data) as MetaAgentMemory;
    return { ...DEFAULT_MEMORY, ...memory };
  } catch (error) {
    // If file doesn't exist, return default memory
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { ...DEFAULT_MEMORY };
    }
    throw error;
  }
}

/**
 * Save the meta-agent memory to disk
 */
export async function saveMemory(memory: MetaAgentMemory): Promise<void> {
  await ensureDirectories();
  memory.lastUpdated = new Date().toISOString();
  await fs.writeFile(MEMORY_FILE, JSON.stringify(memory, null, 2), "utf-8");
}

/**
 * Update memory with a partial update
 */
export async function updateMemory(
  updates: Partial<MetaAgentMemory>
): Promise<MetaAgentMemory> {
  const memory = await loadMemory();
  const updated = { ...memory, ...updates };
  await saveMemory(updated);
  return updated;
}

// ============================================
// Instruction Operations
// ============================================

/**
 * Add a new instruction
 */
export async function addInstruction(
  content: string,
  category: Instruction["category"] = "general"
): Promise<Instruction> {
  const memory = await loadMemory();
  const instruction: Instruction = {
    id: generateId(),
    content,
    category,
    createdAt: new Date().toISOString(),
    active: true,
  };
  memory.instructions.push(instruction);
  await saveMemory(memory);

  // Log evolution event
  await addEvolutionEvent({
    type: "instruction-added",
    description: `Added instruction: ${content.substring(0, 50)}...`,
    details: { instructionId: instruction.id, category },
  });

  return instruction;
}

/**
 * Update an instruction
 */
export async function updateInstruction(
  id: string,
  updates: Partial<Instruction>
): Promise<Instruction | null> {
  const memory = await loadMemory();
  const index = memory.instructions.findIndex((i) => i.id === id);
  if (index === -1) return null;

  memory.instructions[index] = { ...memory.instructions[index], ...updates };
  await saveMemory(memory);
  return memory.instructions[index];
}

/**
 * Delete an instruction
 */
export async function deleteInstruction(id: string): Promise<boolean> {
  const memory = await loadMemory();
  const index = memory.instructions.findIndex((i) => i.id === id);
  if (index === -1) return false;

  memory.instructions.splice(index, 1);
  await saveMemory(memory);
  return true;
}

/**
 * Get active instructions by category
 */
export async function getActiveInstructions(
  category?: Instruction["category"]
): Promise<Instruction[]> {
  const memory = await loadMemory();
  return memory.instructions.filter(
    (i) => i.active && (category ? i.category === category : true)
  );
}

// ============================================
// Preferences Operations
// ============================================

/**
 * Update user preferences
 */
export async function updatePreferences(
  updates: Partial<UserPreferences>
): Promise<UserPreferences> {
  const memory = await loadMemory();
  memory.preferences = { ...memory.preferences, ...updates };
  await saveMemory(memory);
  return memory.preferences;
}

// ============================================
// Evolution History Operations
// ============================================

/**
 * Add an evolution event
 */
export async function addEvolutionEvent(
  event: Omit<EvolutionEvent, "id" | "timestamp">
): Promise<EvolutionEvent> {
  const memory = await loadMemory();
  const evolutionEvent: EvolutionEvent = {
    ...event,
    id: generateId(),
    timestamp: new Date().toISOString(),
  };
  memory.evolutionHistory.push(evolutionEvent);

  // Keep only last 100 events
  if (memory.evolutionHistory.length > 100) {
    memory.evolutionHistory = memory.evolutionHistory.slice(-100);
  }

  await saveMemory(memory);
  return evolutionEvent;
}

// ============================================
// Generated Agents Operations
// ============================================

/**
 * Record a generated agent
 */
export async function recordGeneratedAgent(
  agent: GeneratedAgent
): Promise<void> {
  const memory = await loadMemory();
  memory.generatedAgents.push(agent);
  await saveMemory(memory);
}

/**
 * Add feedback to a generated agent
 */
export async function addAgentFeedback(
  agentId: string,
  feedback: GeneratedAgent["feedback"]
): Promise<boolean> {
  const memory = await loadMemory();
  const agent = memory.generatedAgents.find((a) => a.id === agentId);
  if (!agent) return false;

  agent.feedback = feedback;
  await saveMemory(memory);
  return true;
}

// ============================================
// Feedback Operations
// ============================================

/**
 * Add feedback item
 */
export async function addFeedback(
  feedback: Omit<FeedbackItem, "id" | "timestamp" | "processed">
): Promise<FeedbackItem> {
  const memory = await loadMemory();
  const item: FeedbackItem = {
    ...feedback,
    id: generateId(),
    timestamp: new Date().toISOString(),
    processed: false,
  };
  memory.feedback.push(item);
  await saveMemory(memory);
  return item;
}

/**
 * Mark feedback as processed
 */
export async function markFeedbackProcessed(id: string): Promise<boolean> {
  const memory = await loadMemory();
  const item = memory.feedback.find((f) => f.id === id);
  if (!item) return false;

  item.processed = true;
  await saveMemory(memory);
  return true;
}

// ============================================
// Conversation Operations
// ============================================

/**
 * Get conversation file path
 */
function getConversationPath(id: string): string {
  return path.join(CONVERSATIONS_DIR, `${id}.json`);
}

/**
 * Create a new conversation
 */
export async function createConversation(topic?: string): Promise<Conversation> {
  await ensureDirectories();

  const conversation: Conversation = {
    id: generateId(),
    messages: [],
    topic,
    status: "active",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await fs.writeFile(
    getConversationPath(conversation.id),
    JSON.stringify(conversation, null, 2),
    "utf-8"
  );

  // Update conversation reference in memory
  const memory = await loadMemory();
  const ref: ConversationRef = {
    id: conversation.id,
    topic: topic || "New Conversation",
    startedAt: conversation.createdAt,
    lastMessageAt: conversation.createdAt,
    messageCount: 0,
  };
  memory.conversations.push(ref);

  // Keep only last 50 conversation references
  if (memory.conversations.length > 50) {
    memory.conversations = memory.conversations.slice(-50);
  }

  await saveMemory(memory);
  return conversation;
}

/**
 * Load a conversation by ID
 */
export async function loadConversation(id: string): Promise<Conversation | null> {
  try {
    const data = await fs.readFile(getConversationPath(id), "utf-8");
    return JSON.parse(data) as Conversation;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

/**
 * Save a conversation
 */
export async function saveConversation(conversation: Conversation): Promise<void> {
  await ensureDirectories();
  conversation.updatedAt = new Date().toISOString();
  await fs.writeFile(
    getConversationPath(conversation.id),
    JSON.stringify(conversation, null, 2),
    "utf-8"
  );

  // Update conversation reference in memory
  const memory = await loadMemory();
  const refIndex = memory.conversations.findIndex((c) => c.id === conversation.id);
  if (refIndex !== -1) {
    memory.conversations[refIndex].lastMessageAt = conversation.updatedAt;
    memory.conversations[refIndex].messageCount = conversation.messages.length;
    if (conversation.topic) {
      memory.conversations[refIndex].topic = conversation.topic;
    }
    await saveMemory(memory);
  }
}

/**
 * Add a message to a conversation
 */
export async function addMessageToConversation(
  conversationId: string,
  message: Omit<ChatMessage, "id" | "timestamp">
): Promise<ChatMessage> {
  const conversation = await loadConversation(conversationId);
  if (!conversation) {
    throw new Error(`Conversation ${conversationId} not found`);
  }

  const fullMessage: ChatMessage = {
    ...message,
    id: generateId(),
    timestamp: new Date().toISOString(),
  };

  conversation.messages.push(fullMessage);
  await saveConversation(conversation);
  return fullMessage;
}

/**
 * Get recent conversations
 */
export async function getRecentConversations(
  limit: number = 10
): Promise<ConversationRef[]> {
  const memory = await loadMemory();
  return memory.conversations
    .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
    .slice(0, limit);
}

/**
 * Delete a conversation
 */
export async function deleteConversation(id: string): Promise<boolean> {
  try {
    await fs.unlink(getConversationPath(id));

    const memory = await loadMemory();
    memory.conversations = memory.conversations.filter((c) => c.id !== id);
    await saveMemory(memory);

    return true;
  } catch {
    return false;
  }
}
