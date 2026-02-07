/**
 * Meta-Agent Library
 * Exports for the self-evolving agentic system
 */

// Types
export type {
  MetaAgentMemory,
  Instruction,
  UserPreferences,
  EvolutionEvent,
  GeneratedAgent,
  AgentFeedback,
  ConversationRef,
  FeedbackItem,
  ChatMessage,
  Conversation,
  MessageRole,
  DomainType,
  TopicAnalysis,
  SuggestedPerspective,
  AgentGenerationRequest,
  AgentGenerationResult,
  MetaAgentAction,
  MetaAgentActionType,
  MetaAgentContext,
  MetaAgentChatRequest,
  MetaAgentChatResponse,
  MetaAgentAnalyzeRequest,
  MetaAgentAnalyzeResponse,
  MetaAgentGenerateRequest,
  MetaAgentGenerateResponse,
  MetaAgentInstructionRequest,
  MetaAgentInstructionResponse,
} from "./types";

// Memory operations
export {
  loadMemory,
  saveMemory,
  updateMemory,
  addInstruction,
  updateInstruction,
  deleteInstruction,
  getActiveInstructions,
  updatePreferences,
  addEvolutionEvent,
  recordGeneratedAgent,
  addAgentFeedback,
  addFeedback,
  markFeedbackProcessed,
  createConversation,
  loadConversation,
  saveConversation,
  addMessageToConversation,
  getRecentConversations,
  deleteConversation,
  generateId,
} from "./memory";

// Topic analyzer
export {
  analyzeTopic,
  generateMorePerspectives,
  refinePerspectives,
  suggestClarifyingQuestions,
} from "./topic-analyzer";

// Agent generator
export {
  generateAgents,
  saveGeneratedAgents,
  modifyAgent,
  generateModeratorPrompt,
  applyInstructions,
} from "./agent-generator";

// Service (main orchestrator)
export {
  getContext,
  processMessage,
  getMemoryState,
  analyzeTopicDirect,
  generateAgentsDirect,
  saveAgentsToConfig,
  addMorePerspectives,
  refinePerspectivesWithFeedback,
  getConversationHistory,
  clearSessionCache,
} from "./service";

// Prompt templates
export {
  getMetaAgentSystemPrompt,
  getTopicAnalysisPrompt,
  getAgentGenerationPrompt,
  getConversationalPrompt,
  getFeedbackProcessingPrompt,
  getCodeExplanationPrompt,
  getModificationSuggestionPrompt,
} from "./prompt-templates";
