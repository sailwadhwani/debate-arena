/**
 * POST /api/document/upload
 *
 * Upload and extract text from PDF
 */

import { NextRequest, NextResponse } from "next/server";
import { extractPdfText } from "@/lib/document/extractor";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Check file type
    if (!file.type.includes("pdf")) {
      return NextResponse.json(
        { error: "Only PDF files are supported" },
        { status: 400 }
      );
    }

    // Check file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 10MB" },
        { status: 400 }
      );
    }

    // Extract text from PDF
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await extractPdfText(buffer);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json({
      content: result.content,
      name: file.name,
      source: "pdf",
      pageCount: result.pageCount,
      wordCount: result.wordCount,
    });
  } catch (error) {
    console.error("[API /document/upload] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to process file" },
      { status: 500 }
    );
  }
}
