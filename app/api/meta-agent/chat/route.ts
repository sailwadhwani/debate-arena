/**
 * POST /api/meta-agent/chat
 *
 * Main conversational endpoint for the meta-agent
 */

import { NextRequest, NextResponse } from "next/server";
import { processMessage, getConversationHistory } from "@/lib/meta-agent";
import type { MetaAgentChatRequest, MetaAgentChatResponse } from "@/lib/meta-agent";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as MetaAgentChatRequest;
    const { message, conversationId } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const result = await processMessage(message, conversationId);

    const response: MetaAgentChatResponse = {
      message: result.response,
      conversationId: result.conversationId,
      suggestedActions: result.actions
        .filter((a) => a.status === "completed")
        .map((a) => a.type),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[API /meta-agent/chat] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process message" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation ID required" },
        { status: 400 }
      );
    }

    const conversation = await getConversationHistory(conversationId);
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(conversation);
  } catch (error) {
    console.error("[API /meta-agent/chat GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to load conversation" },
      { status: 500 }
    );
  }
}
