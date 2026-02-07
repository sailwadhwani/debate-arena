/**
 * GET/POST /api/meta-agent/memory
 *
 * Memory read and management endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getMemoryState,
  updatePreferences,
  getRecentConversations,
  deleteConversation,
} from "@/lib/meta-agent";
import type { UserPreferences } from "@/lib/meta-agent";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const section = searchParams.get("section");

    const memory = await getMemoryState();

    switch (section) {
      case "instructions":
        return NextResponse.json({ instructions: memory.instructions });

      case "preferences":
        return NextResponse.json({ preferences: memory.preferences });

      case "history":
        return NextResponse.json({ evolutionHistory: memory.evolutionHistory });

      case "agents":
        return NextResponse.json({ generatedAgents: memory.generatedAgents });

      case "conversations": {
        const limit = parseInt(searchParams.get("limit") || "10");
        const conversations = await getRecentConversations(limit);
        return NextResponse.json({ conversations });
      }

      case "feedback":
        return NextResponse.json({ feedback: memory.feedback });

      default:
        // Return full memory state
        return NextResponse.json(memory);
    }
  } catch (error) {
    console.error("[API /meta-agent/memory GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to load memory" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, data } = body;

    switch (action) {
      case "update_preferences": {
        if (!data) {
          return NextResponse.json(
            { error: "Preferences data required" },
            { status: 400 }
          );
        }
        const preferences = await updatePreferences(data as Partial<UserPreferences>);
        return NextResponse.json({ success: true, preferences });
      }

      case "delete_conversation": {
        const { conversationId } = data || {};
        if (!conversationId) {
          return NextResponse.json(
            { error: "Conversation ID required" },
            { status: 400 }
          );
        }
        const deleted = await deleteConversation(conversationId);
        return NextResponse.json({ success: deleted });
      }

      default:
        return NextResponse.json(
          { error: "Invalid action" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[API /meta-agent/memory POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to update memory" },
      { status: 500 }
    );
  }
}
