/**
 * POST /api/meta-agent/agents
 *
 * Agent generation endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import {
  generateAgentsDirect,
  saveAgentsToConfig,
} from "@/lib/meta-agent";
import type {
  MetaAgentGenerateRequest,
  MetaAgentGenerateResponse,
  SuggestedPerspective,
} from "@/lib/meta-agent";
import type { AgentConfig } from "@/lib/agents/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action = "generate", topic, perspectives, saveToConfig, agents } = body;

    switch (action) {
      case "generate": {
        if (!topic || !perspectives) {
          return NextResponse.json(
            { error: "Topic and perspectives are required" },
            { status: 400 }
          );
        }

        const result = await generateAgentsDirect(
          topic,
          perspectives as SuggestedPerspective[],
          saveToConfig || false
        );

        const response: MetaAgentGenerateResponse = {
          agents: result.agents,
          saved: result.saved,
        };

        if (result.errors && result.errors.length > 0) {
          return NextResponse.json({ ...response, errors: result.errors });
        }

        return NextResponse.json(response);
      }

      case "save": {
        if (!agents || !topic) {
          return NextResponse.json(
            { error: "Agents and topic are required" },
            { status: 400 }
          );
        }

        const { saved, errors } = await saveAgentsToConfig(
          agents as AgentConfig[],
          topic
        );

        return NextResponse.json({
          saved,
          errors,
          success: errors.length === 0,
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[API /meta-agent/agents] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate agents" },
      { status: 500 }
    );
  }
}
