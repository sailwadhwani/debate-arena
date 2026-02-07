/**
 * GET/POST/PUT/DELETE /api/meta-agent/instructions
 *
 * Instruction management endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getActiveInstructions,
  addInstruction,
  updateInstruction,
  deleteInstruction,
  loadMemory,
} from "@/lib/meta-agent";
import type { Instruction, MetaAgentInstructionResponse } from "@/lib/meta-agent";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get("category") as Instruction["category"] | null;
    const activeOnly = searchParams.get("active") !== "false";

    if (activeOnly) {
      const instructions = await getActiveInstructions(category || undefined);
      return NextResponse.json({ instructions });
    }

    const memory = await loadMemory();
    let instructions = memory.instructions;
    if (category) {
      instructions = instructions.filter((i) => i.category === category);
    }

    return NextResponse.json({ instructions });
  } catch (error) {
    console.error("[API /meta-agent/instructions GET] Error:", error);
    return NextResponse.json(
      { error: "Failed to load instructions" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { content, category = "general" } = body;

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Instruction content is required" },
        { status: 400 }
      );
    }

    const instruction = await addInstruction(content, category);
    const memory = await loadMemory();

    const response: MetaAgentInstructionResponse = {
      instructions: memory.instructions,
      message: `Instruction added: "${content.substring(0, 50)}${content.length > 50 ? "..." : ""}"`,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[API /meta-agent/instructions POST] Error:", error);
    return NextResponse.json(
      { error: "Failed to add instruction" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, updates } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Instruction ID is required" },
        { status: 400 }
      );
    }

    const instruction = await updateInstruction(id, updates);
    if (!instruction) {
      return NextResponse.json(
        { error: "Instruction not found" },
        { status: 404 }
      );
    }

    const memory = await loadMemory();
    const response: MetaAgentInstructionResponse = {
      instructions: memory.instructions,
      message: "Instruction updated",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[API /meta-agent/instructions PUT] Error:", error);
    return NextResponse.json(
      { error: "Failed to update instruction" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Instruction ID is required" },
        { status: 400 }
      );
    }

    const deleted = await deleteInstruction(id);
    if (!deleted) {
      return NextResponse.json(
        { error: "Instruction not found" },
        { status: 404 }
      );
    }

    const memory = await loadMemory();
    const response: MetaAgentInstructionResponse = {
      instructions: memory.instructions,
      message: "Instruction deleted",
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[API /meta-agent/instructions DELETE] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete instruction" },
      { status: 500 }
    );
  }
}
