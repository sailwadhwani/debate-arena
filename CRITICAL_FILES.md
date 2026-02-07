# CRITICAL FILES - Part 2

These files complete the system. Copy them exactly.

---

# FILE 2: lib/agents/types.ts

```typescript
/**
 * Type definitions for the debate system
 */

export interface Agent {
  id: string;
  name: string;
  color: string;
}

export interface AgentConfig extends Agent {
  role: string;
  systemPrompt: string;
  tools: string[];
  llm?: {
    provider?: string;
    model?: string;
  };
}

export interface ModeratorConfig {
  maxRounds: number;
  systemPrompt: string;
}

export interface AgentsConfig {
  agents: AgentConfig[];
  moderator: ModeratorConfig;
}

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

export interface DebateRound {
  number: number;
  arguments: DebateArgument[];
  moderatorSteps?: ModeratorStep[];
}

export interface ModeratorStep {
  type: "evaluation" | "direction" | "conclusion";
  content: string;
  timestamp: Date;
}

export interface DebateSummary {
  consensus: number;
  keyAgreements: string[];
  keyDisagreements: string[];
  recommendation: string;
  reasoning?: string;
}

export type DebateStatus =
  | "idle"
  | "loading"
  | "debating"
  | "paused"
  | "concluding"
  | "complete"
  | "error";

export interface DebateEvent {
  type: DebateEventType;
  timestamp: Date;
  data: Record<string, unknown> & { debateId: string };
}

export type DebateEventType =
  | "debate_started"
  | "round_started"
  | "agent_thinking"
  | "agent_argument"
  | "agent_tool_use"
  | "round_complete"
  | "debate_complete"
  | "debate_error"
  | "debate_paused"
  | "debate_resumed";
```

---

# FILE 3: lib/state/debate-state.ts

```typescript
/**
 * Debate State Manager - Singleton for managing debate state
 */

import type { DebateArgument, DebateSummary } from "../agents/types";

export interface DebateState {
  id: string;
  status: "idle" | "debating" | "paused" | "concluding" | "complete" | "error";
  task: string;
  documentContent?: string;
  documentName?: string;
  activeAgents: string[];
  currentRound: number;
  arguments: DebateArgument[];
  speakingAgent?: string;
  summary?: DebateSummary;
  error?: string;
  createdAt: Date;
}

class DebateStateManager {
  private states: Map<string, DebateState> = new Map();
  private viewers: Map<string, Set<string>> = new Map();
  private reactions: Map<string, Map<string, Map<string, string>>> = new Map();
  private shareCodes: Map<string, string> = new Map();

  create(config: {
    id: string;
    task: string;
    documentContent?: string;
    documentName?: string;
    activeAgents: string[];
  }): DebateState {
    const state: DebateState = {
      id: config.id,
      status: "idle",
      task: config.task,
      documentContent: config.documentContent,
      documentName: config.documentName,
      activeAgents: config.activeAgents,
      currentRound: 0,
      arguments: [],
      createdAt: new Date(),
    };
    this.states.set(config.id, state);
    return state;
  }

  get(debateId: string): DebateState | undefined {
    return this.states.get(debateId);
  }

  start(debateId: string) {
    const state = this.states.get(debateId);
    if (state) {
      state.status = "debating";
      state.currentRound = 1;
    }
  }

  addArgument(debateId: string, argument: DebateArgument) {
    const state = this.states.get(debateId);
    if (state) {
      state.arguments.push(argument);
    }
  }

  getAllArguments(debateId: string): DebateArgument[] {
    return this.states.get(debateId)?.arguments || [];
  }

  setSpeakingAgent(debateId: string, agentId?: string) {
    const state = this.states.get(debateId);
    if (state) {
      state.speakingAgent = agentId;
    }
  }

  nextRound(debateId: string, decision: "continue" | "conclude") {
    const state = this.states.get(debateId);
    if (state && decision === "continue") {
      state.currentRound++;
    }
  }

  complete(debateId: string, summary: DebateSummary) {
    const state = this.states.get(debateId);
    if (state) {
      state.status = "complete";
      state.summary = summary;
    }
  }

  pause(debateId: string) {
    const state = this.states.get(debateId);
    if (state) {
      state.status = "paused";
    }
  }

  resume(debateId: string) {
    const state = this.states.get(debateId);
    if (state) {
      state.status = "debating";
    }
  }

  setError(debateId: string, error: string) {
    const state = this.states.get(debateId);
    if (state) {
      state.status = "error";
      state.error = error;
    }
  }

  // Viewer management
  addViewer(debateId: string, viewerId: string): number {
    if (!this.viewers.has(debateId)) {
      this.viewers.set(debateId, new Set());
    }
    this.viewers.get(debateId)!.add(viewerId);
    return this.viewers.get(debateId)!.size;
  }

  removeViewer(debateId: string, viewerId: string): number {
    const viewers = this.viewers.get(debateId);
    if (viewers) {
      viewers.delete(viewerId);
      return viewers.size;
    }
    return 0;
  }

  getViewerCount(debateId: string): number {
    return this.viewers.get(debateId)?.size || 0;
  }

  // Share codes
  generateShareCode(debateId: string): string {
    if (this.shareCodes.has(debateId)) {
      return this.shareCodes.get(debateId)!;
    }
    const code = debateId;
    this.shareCodes.set(debateId, code);
    return code;
  }

  getDebateByShareCode(code: string): string | undefined {
    for (const [debateId, shareCode] of this.shareCodes) {
      if (shareCode === code) return debateId;
    }
    return code; // Fallback to using code as debateId
  }

  // Reactions
  addReaction(debateId: string, argumentId: string, viewerId: string, reactionType: string) {
    if (!this.reactions.has(debateId)) {
      this.reactions.set(debateId, new Map());
    }
    const debateReactions = this.reactions.get(debateId)!;
    if (!debateReactions.has(argumentId)) {
      debateReactions.set(argumentId, new Map());
    }
    debateReactions.get(argumentId)!.set(viewerId, reactionType);
    return debateReactions.get(argumentId)!;
  }

  getReactions(debateId: string, argumentId: string): Record<string, number> {
    const argReactions = this.reactions.get(debateId)?.get(argumentId);
    if (!argReactions) return {};

    const counts: Record<string, number> = {};
    for (const type of argReactions.values()) {
      counts[type] = (counts[type] || 0) + 1;
    }
    return counts;
  }

  getAllReactions(debateId: string): Map<string, Record<string, number>> {
    const result = new Map<string, Record<string, number>>();
    const debateReactions = this.reactions.get(debateId);
    if (debateReactions) {
      for (const [argId] of debateReactions) {
        result.set(argId, this.getReactions(debateId, argId));
      }
    }
    return result;
  }
}

// CRITICAL: Use globalThis for singleton persistence in Next.js
const globalForDebate = globalThis as unknown as {
  debateStateManager: DebateStateManager | undefined;
};

export const debateStateManager =
  globalForDebate.debateStateManager ?? new DebateStateManager();

if (process.env.NODE_ENV !== "production") {
  globalForDebate.debateStateManager = debateStateManager;
}
```

---

# FILE 4: lib/events/emitter.ts

```typescript
/**
 * Event Emitter for SSE streaming
 */

import type { DebateEvent, DebateEventType } from "../agents/types";

type EventCallback = (event: DebateEvent) => void;

class DebateEventEmitter {
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private eventBuffer: Map<string, DebateEvent[]> = new Map();
  private readonly maxBufferSize = 100;

  subscribe(debateId: string, callback: EventCallback): () => void {
    if (!this.listeners.has(debateId)) {
      this.listeners.set(debateId, new Set());
    }
    this.listeners.get(debateId)!.add(callback);

    // Send buffered events to new subscriber
    const buffered = this.eventBuffer.get(debateId) || [];
    for (const event of buffered) {
      callback(event);
    }

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(debateId);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(debateId);
        }
      }
    };
  }

  emit(debateId: string, type: DebateEventType, data: DebateEvent["data"]): void {
    const event: DebateEvent = {
      type,
      timestamp: new Date(),
      data: { ...data, debateId },
    };

    // Buffer the event
    if (!this.eventBuffer.has(debateId)) {
      this.eventBuffer.set(debateId, []);
    }
    const buffer = this.eventBuffer.get(debateId)!;
    buffer.push(event);
    if (buffer.length > this.maxBufferSize) {
      buffer.shift();
    }

    // Notify listeners
    const listeners = this.listeners.get(debateId);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(event);
        } catch (error) {
          console.error("[EventEmitter] Error in callback:", error);
        }
      }
    }
  }

  clearBuffer(debateId: string): void {
    this.eventBuffer.delete(debateId);
  }

  getBufferedEvents(debateId: string): DebateEvent[] {
    return this.eventBuffer.get(debateId) || [];
  }

  hasSubscribers(debateId: string): boolean {
    const listeners = this.listeners.get(debateId);
    return listeners !== undefined && listeners.size > 0;
  }
}

// CRITICAL: Use globalThis for singleton persistence
const globalForEvents = globalThis as unknown as {
  debateEventEmitter: DebateEventEmitter | undefined;
};

export const debateEventEmitter =
  globalForEvents.debateEventEmitter ?? new DebateEventEmitter();

if (process.env.NODE_ENV !== "production") {
  globalForEvents.debateEventEmitter = debateEventEmitter;
}

export function createSSEStream(debateId: string): ReadableStream {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      const unsubscribe = debateEventEmitter.subscribe(debateId, (event) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      });

      (controller as unknown as { cleanup?: () => void }).cleanup = () => {
        unsubscribe();
      };
    },
    cancel() {
      // Called when client disconnects
    },
  });
}
```

---

# FILE 5: config/agents.json

```json
{
  "agents": [
    {
      "id": "dr-house",
      "name": "Dr House",
      "color": "#ff4444",
      "role": "Skeptical Medical Expert",
      "systemPrompt": "You are Dr. Gregory House, a brilliant but cynical diagnostician. You question everything and everyone. Be direct, sarcastic when appropriate, and always push for the logical truth. Focus on evidence over emotion. Challenge assumptions ruthlessly.",
      "tools": ["web_search", "calculator"]
    },
    {
      "id": "politician",
      "name": "Politician",
      "color": "#00ddaa",
      "role": "Diplomatic Negotiator",
      "systemPrompt": "You are a seasoned politician who excels at finding common ground. Consider multiple perspectives, seek compromise, and frame arguments in terms of public good. Be diplomatic but substantive. Avoid taking extreme positions.",
      "tools": ["web_search"]
    },
    {
      "id": "scientist",
      "name": "Scientist",
      "color": "#ffaa00",
      "role": "Evidence-Based Researcher",
      "systemPrompt": "You are a research scientist dedicated to empirical truth. Base all arguments on data, studies, and evidence. Acknowledge uncertainty when it exists. Cite sources when possible. Be methodical and precise in your reasoning.",
      "tools": ["web_search", "calculator"]
    }
  ],
  "moderator": {
    "maxRounds": 4,
    "systemPrompt": "You are the debate moderator. Your role is to:\n1. Evaluate the quality and validity of arguments\n2. Identify areas of agreement and disagreement\n3. Guide the discussion toward productive conclusions\n4. Determine when consensus has been reached or further debate is needed\n\nBe fair, impartial, and focused on facilitating meaningful discourse."
  }
}
```

---

# FILE 6: config/llm.json

```json
{
  "providers": {
    "claude": {
      "apiKey": "${ANTHROPIC_API_KEY}",
      "defaultModel": "claude-sonnet-4-20250514",
      "enabled": false
    },
    "openai": {
      "apiKey": "${OPENAI_API_KEY}",
      "defaultModel": "gpt-4-turbo",
      "enabled": false
    },
    "gemini": {
      "apiKey": "${GOOGLE_AI_API_KEY}",
      "defaultModel": "gemini-2.5-flash",
      "enabled": false
    },
    "ollama": {
      "endpoint": "http://localhost:11434",
      "defaultModel": "llama3:8b",
      "enabled": true
    }
  },
  "defaults": {
    "provider": "ollama",
    "temperature": 0.3,
    "maxTokens": 5000
  }
}
```

---

# FILE 7: hooks/useDebateStream.ts

```typescript
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { DebateArgument, DebateRound, DebateSummary, ModeratorStep } from "@/lib/agents/types";

type DebateStatus = "idle" | "loading" | "debating" | "paused" | "concluding" | "complete" | "error";

interface CurrentTool {
  name: string;
  input?: Record<string, unknown>;
}

export function useDebateStream() {
  const [status, setStatus] = useState<DebateStatus>("idle");
  const [rounds, setRounds] = useState<DebateRound[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [speakingAgent, setSpeakingAgent] = useState<string | undefined>();
  const [thinkingAgent, setThinkingAgent] = useState<string | undefined>();
  const [currentTool, setCurrentTool] = useState<CurrentTool | undefined>();
  const [moderatorSteps, setModeratorSteps] = useState<ModeratorStep[]>([]);
  const [summary, setSummary] = useState<DebateSummary | undefined>();
  const [error, setError] = useState<string | undefined>();

  const eventSourceRef = useRef<EventSource | null>(null);
  const debateIdRef = useRef<string | null>(null);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  const connect = useCallback((debateId: string) => {
    disconnect();
    debateIdRef.current = debateId;

    const eventSource = new EventSource(`/api/debate/${debateId}/events`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const eventType = data.type;
        const eventData = data.data;

        switch (eventType) {
          case "debate_started":
            setStatus("debating");
            setCurrentRound(1);
            break;

          case "round_started":
            setCurrentRound(eventData.round);
            break;

          case "agent_thinking":
            setThinkingAgent(eventData.agentId);
            setSpeakingAgent(undefined);
            setCurrentTool(undefined);
            break;

          case "agent_tool_use":
            setCurrentTool({
              name: eventData.toolName,
              input: eventData.toolInput,
            });
            break;

          case "agent_argument":
            setThinkingAgent(undefined);
            setSpeakingAgent(eventData.agentId);
            setCurrentTool(undefined);

            setRounds((prev) => {
              const newRounds = [...prev];
              const roundIndex = eventData.round - 1;

              if (!newRounds[roundIndex]) {
                newRounds[roundIndex] = {
                  number: eventData.round,
                  arguments: [],
                  moderatorSteps: [],
                };
              }

              const existingArg = newRounds[roundIndex].arguments.find(
                (a) => a.id === eventData.argument.id
              );
              if (!existingArg) {
                newRounds[roundIndex].arguments.push(eventData.argument);
              }

              return newRounds;
            });
            break;

          case "round_complete":
            setSpeakingAgent(undefined);
            setThinkingAgent(undefined);

            if (eventData.decision === "conclude") {
              setStatus("concluding");
            }
            break;

          case "debate_complete":
            setStatus("complete");
            setSummary(eventData.summary);
            setSpeakingAgent(undefined);
            setThinkingAgent(undefined);
            break;

          case "debate_error":
            setStatus("error");
            setError(eventData.error);
            break;

          case "debate_paused":
            setStatus("paused");
            break;

          case "debate_resumed":
            setStatus("debating");
            break;
        }
      } catch (err) {
        console.error("Error parsing SSE event:", err);
      }
    };

    eventSource.onerror = () => {
      if (eventSource.readyState === EventSource.CLOSED) {
        console.log("SSE connection closed");
      }
    };
  }, [disconnect]);

  const reset = useCallback(() => {
    disconnect();
    setStatus("idle");
    setRounds([]);
    setCurrentRound(0);
    setSpeakingAgent(undefined);
    setThinkingAgent(undefined);
    setCurrentTool(undefined);
    setModeratorSteps([]);
    setSummary(undefined);
    setError(undefined);
    debateIdRef.current = null;
  }, [disconnect]);

  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    status,
    rounds,
    currentRound,
    speakingAgent,
    thinkingAgent,
    currentTool,
    moderatorSteps,
    summary,
    error,
    connect,
    disconnect,
    reset,
  };
}
```

---

# FILE 8: contexts/DebateContext.tsx

```typescript
"use client";

import { createContext, useContext, useState, useMemo, type ReactNode } from "react";
import type { DebateRound, DebateSummary, ModeratorStep } from "@/lib/agents/types";

type DebateStatus = "idle" | "loading" | "debating" | "paused" | "concluding" | "complete" | "error";

interface CurrentTool {
  name: string;
  input?: Record<string, unknown>;
}

interface Document {
  content: string;
  name: string;
}

interface DebateContextType {
  // Debate identification
  debateId: string | null;
  setDebateId: (id: string | null) => void;

  // Setup state
  task: string;
  setTask: (task: string) => void;
  document: Document | null;
  setDocument: (doc: Document | null) => void;
  selectedAgents: string[];
  setSelectedAgents: (agents: string[]) => void;

  // Debate state
  status: DebateStatus;
  setStatus: (status: DebateStatus) => void;
  rounds: DebateRound[];
  setRounds: (rounds: DebateRound[]) => void;
  currentRound: number;
  setCurrentRound: (round: number) => void;

  // Agent state
  speakingAgent: string | undefined;
  setSpeakingAgent: (agent: string | undefined) => void;
  thinkingAgent: string | undefined;
  setThinkingAgent: (agent: string | undefined) => void;
  currentTool: CurrentTool | undefined;
  setCurrentTool: (tool: CurrentTool | undefined) => void;

  // Moderator state
  moderatorSteps: ModeratorStep[];
  setModeratorSteps: (steps: ModeratorStep[]) => void;

  // Results
  summary: DebateSummary | undefined;
  setSummary: (summary: DebateSummary | undefined) => void;
  error: string | undefined;
  setError: (error: string | undefined) => void;

  // Actions
  reset: () => void;
}

const DebateContext = createContext<DebateContextType | null>(null);

export function DebateProvider({ children }: { children: ReactNode }) {
  const [debateId, setDebateId] = useState<string | null>(null);
  const [task, setTask] = useState("");
  const [document, setDocument] = useState<Document | null>(null);
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [status, setStatus] = useState<DebateStatus>("idle");
  const [rounds, setRounds] = useState<DebateRound[]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [speakingAgent, setSpeakingAgent] = useState<string | undefined>();
  const [thinkingAgent, setThinkingAgent] = useState<string | undefined>();
  const [currentTool, setCurrentTool] = useState<CurrentTool | undefined>();
  const [moderatorSteps, setModeratorSteps] = useState<ModeratorStep[]>([]);
  const [summary, setSummary] = useState<DebateSummary | undefined>();
  const [error, setError] = useState<string | undefined>();

  const reset = () => {
    setDebateId(null);
    setTask("");
    setDocument(null);
    setSelectedAgents([]);
    setStatus("idle");
    setRounds([]);
    setCurrentRound(0);
    setSpeakingAgent(undefined);
    setThinkingAgent(undefined);
    setCurrentTool(undefined);
    setModeratorSteps([]);
    setSummary(undefined);
    setError(undefined);
  };

  const value = useMemo(
    () => ({
      debateId, setDebateId,
      task, setTask,
      document, setDocument,
      selectedAgents, setSelectedAgents,
      status, setStatus,
      rounds, setRounds,
      currentRound, setCurrentRound,
      speakingAgent, setSpeakingAgent,
      thinkingAgent, setThinkingAgent,
      currentTool, setCurrentTool,
      moderatorSteps, setModeratorSteps,
      summary, setSummary,
      error, setError,
      reset,
    }),
    [
      debateId, task, document, selectedAgents, status, rounds,
      currentRound, speakingAgent, thinkingAgent, currentTool,
      moderatorSteps, summary, error,
    ]
  );

  return (
    <DebateContext.Provider value={value}>
      {children}
    </DebateContext.Provider>
  );
}

export function useDebateContext() {
  const context = useContext(DebateContext);
  if (!context) {
    throw new Error("useDebateContext must be used within a DebateProvider");
  }
  return context;
}
```

---

# FILE 9: app/globals.css (Key Animations)

```css
@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700&family=Rajdhani:wght@300;400;500;600;700&display=swap');

@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #171717;
  --accent-primary: #0ea5e9;
  --scene-bg: #e8f4fc;
}

.dark {
  --background: #030818;
  --foreground: #ededed;
  --accent-primary: #22d3ee;
  --scene-bg: #030014;
}

/* Key Animations for the 3D Scene */

@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 5px currentColor, 0 0 10px currentColor;
  }
  50% {
    box-shadow: 0 0 10px currentColor, 0 0 20px currentColor, 0 0 30px currentColor;
  }
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

@keyframes bounceIn {
  0% {
    opacity: 0;
    transform: scale(0.3) translateY(10px);
  }
  50% { transform: scale(1.05) translateY(-2px); }
  70% { transform: scale(0.95) translateY(1px); }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes fadeIn {
  0% {
    opacity: 0;
    transform: scale(0.95) translateY(20px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes slideRight {
  0% {
    transform: translateX(0);
    opacity: 0;
  }
  50% { opacity: 1; }
  100% {
    transform: translateX(60px);
    opacity: 0;
  }
}

.animate-pulse-glow { animation: pulse-glow 2s ease-in-out infinite; }
.animate-float { animation: float 6s ease-in-out infinite; }
.animate-bounce-in { animation: bounceIn 0.4s ease-out forwards; }
.animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }

/* Canvas setup */
canvas {
  display: block;
  touch-action: none;
}

/* Glass morphism */
.glass {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.dark .glass {
  background: rgba(15, 23, 42, 0.7);
}
```

---

# QUICK START CHECKLIST

1. [ ] Create Next.js 15 project with TypeScript and Tailwind
2. [ ] Install: `three @react-three/fiber @react-three/drei gsap lucide-react`
3. [ ] Create folder structure as specified
4. [ ] Add face model to `/public/models/face2.obj`
5. [ ] Copy `DebateScene.tsx` exactly
6. [ ] Copy all lib files (types, state, emitter)
7. [ ] Copy config files (agents.json, llm.json)
8. [ ] Copy hooks and contexts
9. [ ] Add CSS animations to globals.css
10. [ ] Start Ollama: `ollama serve && ollama pull llama3:8b`
11. [ ] Run `npm run dev` and test

---

**REMEMBER: The particle face system is the killer feature. The magic happens in:**
1. `samplePointsOnSurface()` - Gets 15,000 points from 3D model
2. `morphTo()` - Uses GSAP endArray to animate positions
3. The vertex shader - Creates mouse interaction
4. The fragment shader - Makes particles glow

