"use client";

import { useMetaAgentContext } from "@/contexts/MetaAgentContext";
import { useDebateContext } from "@/contexts/DebateContext";
import { MetaAgentPanel, MetaAgentButton } from "./MetaAgentPanel";
import { useRouter } from "next/navigation";
import type { AgentConfig } from "@/lib/agents/types";

export function MetaAgentWrapper() {
  const router = useRouter();
  const {
    isPanelOpen,
    isPanelMinimized,
    openPanel,
    closePanel,
    toggleMinimize,
  } = useMetaAgentContext();

  const debateCtx = useDebateContext();

  const handleStartDebate = async (agents: AgentConfig[], topic: string) => {
    // Reset any previous debate state first
    debateCtx.resetDebate();

    // Set the task from the meta-agent
    debateCtx.setTask(topic);

    // Set selected agents to the generated agent IDs
    debateCtx.setSelectedAgents(agents.map((a) => a.id));

    // Show setup dialog so user can review and start
    debateCtx.setShowSetup(true);

    // Navigate to debate page
    router.push("/debate");
  };

  return (
    <>
      {!isPanelOpen && <MetaAgentButton onClick={openPanel} />}
      <MetaAgentPanel
        isOpen={isPanelOpen}
        onClose={closePanel}
        minimized={isPanelMinimized}
        onToggleMinimize={toggleMinimize}
        onStartDebate={handleStartDebate}
      />
    </>
  );
}
