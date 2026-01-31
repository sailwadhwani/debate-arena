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

interface UseDebateStreamResult {
  status: DebateStatus;
  rounds: DebateState["rounds"];
  currentRound: number;
  speakingAgent: string | undefined;
  arguments: DebateArgument[];
  moderatorSteps: ModeratorStep[];
  summary: DebateSummary | undefined;
  error: string | undefined;
  connect: (debateId: string) => void;
  disconnect: () => void;
}

export function useDebateStream(): UseDebateStreamResult {
  const [status, setStatus] = useState<DebateStatus>("idle");
  const [rounds, setRounds] = useState<DebateState["rounds"]>([]);
  const [currentRound, setCurrentRound] = useState(0);
  const [speakingAgent, setSpeakingAgent] = useState<string | undefined>();
  const [moderatorSteps, setModeratorSteps] = useState<ModeratorStep[]>([]);
  const [summary, setSummary] = useState<DebateSummary | undefined>();
  const [error, setError] = useState<string | undefined>();
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback((debateId: string) => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Reset state
    setStatus("loading");
    setRounds([]);
    setCurrentRound(0);
    setSpeakingAgent(undefined);
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
        setSpeakingAgent(event.data.agentId);
        break;

      case "agent_argument":
        setSpeakingAgent(undefined);
        if (event.data.argument) {
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
          setRounds((prev) => [
            ...prev,
            { number: nextRound, arguments: [], moderatorSteps: [] },
          ]);
        } else {
          setStatus("concluding");
        }
        break;

      case "debate_complete":
        setStatus("complete");
        if (event.data.summary) {
          setSummary(event.data.summary);
        }
        break;

      case "debate_error":
        setStatus("error");
        setError(event.data.error);
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
    arguments: allArguments,
    moderatorSteps,
    summary,
    error,
    connect,
    disconnect,
  };
}
