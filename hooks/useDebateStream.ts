"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  DebateEvent,
  DebateState,
  DebateArgument,
  ModeratorStep,
  DebateSummary,
  DebateStatus,
} from "@/lib/agents/types";

interface CurrentTool {
  name: string;
  input?: Record<string, unknown>;
}

interface UseDebateStreamResult {
  status: DebateStatus;
  rounds: DebateState["rounds"];
  currentRound: number;
  speakingAgent: string | undefined;
  thinkingAgent: string | undefined;
  currentTool: CurrentTool | undefined;
  arguments: DebateArgument[];
  moderatorSteps: ModeratorStep[];
  summary: DebateSummary | undefined;
  error: string | undefined;
  debateId: string | null;
  connect: (debateId: string) => void;
  disconnect: () => void;
  pause: () => Promise<boolean>;
  resume: () => Promise<boolean>;
}

export function useDebateStream(): UseDebateStreamResult {
  const [status, setStatus] = useState<DebateStatus>("idle");
  const [rounds, setRounds] = useState<DebateState["rounds"]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [speakingAgent, setSpeakingAgent] = useState<string | undefined>();
  const [thinkingAgent, setThinkingAgent] = useState<string | undefined>();
  const [currentTool, setCurrentTool] = useState<CurrentTool | undefined>();
  const [moderatorSteps, setModeratorSteps] = useState<ModeratorStep[]>([]);
  const [summary, setSummary] = useState<DebateSummary | undefined>();
  const [error, setError] = useState<string | undefined>();
  const eventSourceRef = useRef<EventSource | null>(null);
  const debateIdRef = useRef<string | null>(null);

  const connect = useCallback((debateId: string) => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    debateIdRef.current = debateId;

    // Reset state
    setStatus("loading");
    setRounds([]);
    setCurrentRound(0);
    setSpeakingAgent(undefined);
    setThinkingAgent(undefined);
    setCurrentTool(undefined);
    setModeratorSteps([]);
    setSummary(undefined);
    setError(undefined);

    // Create new EventSource
    const eventSource = new EventSource(`/api/debate/events?debateId=${debateId}`);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const debateEvent: DebateEvent = JSON.parse(event.data);
        handleEvent(debateEvent);
      } catch (e) {
        console.error("Failed to parse event:", e);
      }
    };

    eventSource.onerror = () => {
      setError("Connection lost. Please refresh the page.");
      setStatus("error");
    };
  }, []);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    debateIdRef.current = null;

    // Reset all state
    setStatus("idle");
    setRounds([]);
    setCurrentRound(0);
    setSpeakingAgent(undefined);
    setThinkingAgent(undefined);
    setCurrentTool(undefined);
    setModeratorSteps([]);
    setSummary(undefined);
    setError(undefined);
  }, []);

  const pause = useCallback(async (): Promise<boolean> => {
    if (!debateIdRef.current) return false;

    try {
      const response = await fetch(`/api/debate/${debateIdRef.current}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pause" }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to pause debate");
        return false;
      }

      setStatus("paused");
      setSpeakingAgent(undefined);
      setThinkingAgent(undefined);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to pause debate");
      return false;
    }
  }, []);

  const resume = useCallback(async (): Promise<boolean> => {
    if (!debateIdRef.current) return false;

    try {
      const response = await fetch(`/api/debate/${debateIdRef.current}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resume" }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error || "Failed to resume debate");
        return false;
      }

      setStatus("debating");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to resume debate");
      return false;
    }
  }, []);

  const handleEvent = useCallback((event: DebateEvent) => {
    switch (event.type) {
      case "debate_started":
        setStatus("debating");
        setCurrentRound(1);
        setRounds([{ number: 1, arguments: [], moderatorSteps: [] }]);
        break;

      case "round_started":
        setCurrentRound(event.data.round || 1);
        // Don't clear moderator steps - keep history across rounds
        break;

      case "agent_thinking":
        setThinkingAgent(event.data.agentId);
        setCurrentTool(undefined); // Clear any previous tool
        break;

      case "agent_tool_use":
        setCurrentTool({
          name: event.data.toolName as string,
          input: event.data.toolInput as Record<string, unknown> | undefined,
        });
        break;

      case "agent_argument":
        setThinkingAgent(undefined);
        setCurrentTool(undefined);
        if (event.data.argument) {
          setSpeakingAgent(event.data.argument.agentId);
          setRounds((prev) => {
            const updated = [...prev];
            const roundIndex = updated.findIndex(
              (r) => r.number === event.data.round
            );
            if (roundIndex >= 0) {
              updated[roundIndex] = {
                ...updated[roundIndex],
                arguments: [...updated[roundIndex].arguments, event.data.argument!],
              };
            } else {
              updated.push({
                number: event.data.round || 1,
                arguments: [event.data.argument!],
                moderatorSteps: [],
              });
            }
            return updated;
          });
        }
        break;

      case "moderator_step":
        if (event.data.moderatorStep) {
          const stepWithRound = {
            ...event.data.moderatorStep!,
            round: event.data.round || currentRound,
          };
          setModeratorSteps((prev) => [...prev, stepWithRound]);

          // Also store in round's moderatorSteps
          setRounds((prev) => {
            const updated = [...prev];
            const roundIndex = updated.findIndex(
              (r) => r.number === (event.data.round || currentRound)
            );
            if (roundIndex >= 0) {
              updated[roundIndex] = {
                ...updated[roundIndex],
                moderatorSteps: [...(updated[roundIndex].moderatorSteps || []), stepWithRound],
              };
            }
            return updated;
          });
        }
        break;

      case "round_complete":
        setRounds((prev) => {
          const updated = [...prev];
          const roundIndex = updated.findIndex(
            (r) => r.number === event.data.round
          );
          if (roundIndex >= 0) {
            updated[roundIndex] = {
              ...updated[roundIndex],
              decision: event.data.decision as "continue" | "conclude",
            };
          }
          return updated;
        });

        if (event.data.decision === "continue") {
          const nextRound = (event.data.round || 0) + 1;
          setCurrentRound(nextRound);
          setSpeakingAgent(undefined);
          setThinkingAgent(undefined);
          setRounds((prev) => [
            ...prev,
            { number: nextRound, arguments: [], moderatorSteps: [] },
          ]);
        } else {
          setStatus("concluding");
          setSpeakingAgent(undefined);
          setThinkingAgent(undefined);
        }
        break;

      case "debate_complete":
        setStatus("complete");
        setSpeakingAgent(undefined);
        setThinkingAgent(undefined);
        if (event.data.summary) {
          setSummary(event.data.summary);
        }
        break;

      case "debate_error":
        setStatus("error");
        setError(event.data.error);
        break;

      // Handle pause/resume events
      case "debate_paused" as any:
        setStatus("paused");
        setSpeakingAgent(undefined);
        setThinkingAgent(undefined);
        break;

      case "debate_resumed" as any:
        setStatus("debating");
        break;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Flatten arguments from all rounds
  const allArguments = rounds.flatMap((r) => r.arguments);

  return {
    status,
    rounds,
    currentRound,
    speakingAgent,
    thinkingAgent,
    currentTool,
    arguments: allArguments,
    moderatorSteps,
    summary,
    error,
    debateId: debateIdRef.current,
    connect,
    disconnect,
    pause,
    resume,
  };
}
