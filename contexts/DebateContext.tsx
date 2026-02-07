"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { DebateArgument, ModeratorStep, DebateSummary, DebateStatus, DebateRound } from "@/lib/agents/types";

interface CurrentTool {
  name: string;
  input?: Record<string, unknown>;
}

interface DebateState {
  debateId: string | null;
  status: DebateStatus;
  task: string;
  document: { content: string; name: string } | null;
  selectedAgents: string[];
  rounds: DebateRound[];
  currentRound: number;
  speakingAgent: string | undefined;
  thinkingAgent: string | undefined;
  currentTool: CurrentTool | undefined;
  moderatorSteps: ModeratorStep[];
  summary: DebateSummary | undefined;
  error: string | undefined;
  view: "2d" | "3d";
  showSetup: boolean;
}

interface DebateContextType extends DebateState {
  setDebateId: (id: string | null) => void;
  setStatus: (status: DebateStatus) => void;
  setTask: (task: string) => void;
  setDocument: (doc: { content: string; name: string } | null) => void;
  setSelectedAgents: (agents: string[]) => void;
  setRounds: (rounds: DebateRound[] | ((prev: DebateRound[]) => DebateRound[])) => void;
  setCurrentRound: (round: number) => void;
  setSpeakingAgent: (agent: string | undefined) => void;
  setThinkingAgent: (agent: string | undefined) => void;
  setCurrentTool: (tool: CurrentTool | undefined) => void;
  setModeratorSteps: (steps: ModeratorStep[] | ((prev: ModeratorStep[]) => ModeratorStep[])) => void;
  setSummary: (summary: DebateSummary | undefined) => void;
  setError: (error: string | undefined) => void;
  setView: (view: "2d" | "3d") => void;
  setShowSetup: (show: boolean) => void;
  resetDebate: () => void;
}

const initialState: DebateState = {
  debateId: null,
  status: "idle",
  task: "",
  document: null,
  selectedAgents: [],
  rounds: [],
  currentRound: 0,
  speakingAgent: undefined,
  thinkingAgent: undefined,
  currentTool: undefined,
  moderatorSteps: [],
  summary: undefined,
  error: undefined,
  view: "3d",
  showSetup: true,
};

const DebateContext = createContext<DebateContextType | null>(null);

export function DebateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DebateState>(initialState);

  const setDebateId = useCallback((debateId: string | null) => {
    setState((prev) => ({ ...prev, debateId }));
  }, []);

  const setStatus = useCallback((status: DebateStatus) => {
    setState((prev) => ({ ...prev, status }));
  }, []);

  const setTask = useCallback((task: string) => {
    setState((prev) => ({ ...prev, task }));
  }, []);

  const setDocument = useCallback((document: { content: string; name: string } | null) => {
    setState((prev) => ({ ...prev, document }));
  }, []);

  const setSelectedAgents = useCallback((selectedAgents: string[]) => {
    setState((prev) => ({ ...prev, selectedAgents }));
  }, []);

  const setRounds = useCallback((rounds: DebateRound[] | ((prev: DebateRound[]) => DebateRound[])) => {
    setState((prev) => ({
      ...prev,
      rounds: typeof rounds === "function" ? rounds(prev.rounds) : rounds,
    }));
  }, []);

  const setCurrentRound = useCallback((currentRound: number) => {
    setState((prev) => ({ ...prev, currentRound }));
  }, []);

  const setSpeakingAgent = useCallback((speakingAgent: string | undefined) => {
    setState((prev) => ({ ...prev, speakingAgent }));
  }, []);

  const setThinkingAgent = useCallback((thinkingAgent: string | undefined) => {
    setState((prev) => ({ ...prev, thinkingAgent }));
  }, []);

  const setCurrentTool = useCallback((currentTool: CurrentTool | undefined) => {
    setState((prev) => ({ ...prev, currentTool }));
  }, []);

  const setModeratorSteps = useCallback((steps: ModeratorStep[] | ((prev: ModeratorStep[]) => ModeratorStep[])) => {
    setState((prev) => ({
      ...prev,
      moderatorSteps: typeof steps === "function" ? steps(prev.moderatorSteps) : steps,
    }));
  }, []);

  const setSummary = useCallback((summary: DebateSummary | undefined) => {
    setState((prev) => ({ ...prev, summary }));
  }, []);

  const setError = useCallback((error: string | undefined) => {
    setState((prev) => ({ ...prev, error }));
  }, []);

  const setView = useCallback((view: "2d" | "3d") => {
    setState((prev) => ({ ...prev, view }));
  }, []);

  const setShowSetup = useCallback((showSetup: boolean) => {
    setState((prev) => ({ ...prev, showSetup }));
  }, []);

  const resetDebate = useCallback(() => {
    setState((prev) => ({
      ...initialState,
      task: prev.task,
      document: prev.document,
      selectedAgents: prev.selectedAgents,
      view: prev.view,
    }));
  }, []);

  return (
    <DebateContext.Provider
      value={{
        ...state,
        setDebateId,
        setStatus,
        setTask,
        setDocument,
        setSelectedAgents,
        setRounds,
        setCurrentRound,
        setSpeakingAgent,
        setThinkingAgent,
        setCurrentTool,
        setModeratorSteps,
        setSummary,
        setError,
        setView,
        setShowSetup,
        resetDebate,
      }}
    >
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
