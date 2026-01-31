/**
 * GET/PUT /api/agents
 *
 * Agent configuration CRUD
 */

import { NextRequest, NextResponse } from "next/server";
import {
  loadAgentsConfig,
  saveAgentsConfig,
  addAgent,
  updateAgent,
  deleteAgent,
  updateModerator,
} from "@/lib/config/loader";
import type { AgentConfig, ModeratorConfig } from "@/lib/agents/types";

export async function GET() {
  try {
    const config = await loadAgentsConfig();
    return NextResponse.json(config);
  } catch (error) {
    console.error("[API /agents GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to load agents config" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, agent, agentId, updates } = body;

    switch (action) {
      case "add": {
        if (!agent) {
          return NextResponse.json(
            { error: "Agent config required" },
            { status: 400 }
          );
        }
        const newAgent = await addAgent(agent as AgentConfig);
        return NextResponse.json({ success: true, agent: newAgent });
      }

      case "update": {
        if (!agentId || !updates) {
          return NextResponse.json(
            { error: "Agent ID and updates required" },
            { status: 400 }
          );
        }
        const updatedAgent = await updateAgent(agentId, updates);
        if (!updatedAgent) {
          return NextResponse.json({ error: "Agent not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true, agent: updatedAgent });
      }

      case "delete": {
        if (!agentId) {
          return NextResponse.json(
            { error: "Agent ID required" },
            { status: 400 }
          );
        }
        const deleted = await deleteAgent(agentId);
        if (!deleted) {
          return NextResponse.json({ error: "Agent not found" }, { status: 404 });
        }
        return NextResponse.json({ success: true });
      }

      case "saveAll": {
        const config = body.config;
        if (!config) {
          return NextResponse.json(
            { error: "Config required" },
            { status: 400 }
          );
        }
        await saveAgentsConfig(config);
        return NextResponse.json({ success: true });
      }

      case "updateModerator": {
        const { moderator } = body;
        if (!moderator) {
          return NextResponse.json(
            { error: "Moderator config required" },
            { status: 400 }
          );
        }
        const updated = await updateModerator(moderator as ModeratorConfig);
        return NextResponse.json({ success: true, moderator: updated });
      }

      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }
  } catch (error) {
    console.error("[API /agents PUT] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update agents" },
      { status: 500 }
    );
  }
}
