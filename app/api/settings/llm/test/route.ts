/**
 * POST /api/settings/llm/test
 *
 * Test connection to an LLM provider
 */

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { provider } = await request.json();

    let success = false;
    let error = "";

    switch (provider) {
      case "claude": {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          error = "ANTHROPIC_API_KEY not set";
          break;
        }
        try {
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": apiKey,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-3-5-haiku-20241022",
              max_tokens: 10,
              messages: [{ role: "user", content: "Hi" }],
            }),
          });
          success = res.ok;
          if (!success) {
            const data = await res.json();
            error = data.error?.message || "Unknown error";
          }
        } catch (e) {
          error = e instanceof Error ? e.message : "Connection failed";
        }
        break;
      }

      case "openai": {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          error = "OPENAI_API_KEY not set";
          break;
        }
        try {
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model: "gpt-3.5-turbo",
              max_tokens: 10,
              messages: [{ role: "user", content: "Hi" }],
            }),
          });
          success = res.ok;
          if (!success) {
            const data = await res.json();
            error = data.error?.message || "Unknown error";
          }
        } catch (e) {
          error = e instanceof Error ? e.message : "Connection failed";
        }
        break;
      }

      case "gemini": {
        const apiKey = process.env.GOOGLE_AI_API_KEY;
        if (!apiKey) {
          error = "GOOGLE_AI_API_KEY not set";
          break;
        }
        try {
          const res = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: "Hi" }] }],
              }),
            }
          );
          success = res.ok;
          if (!success) {
            const data = await res.json();
            error = data.error?.message || "Unknown error";
          }
        } catch (e) {
          error = e instanceof Error ? e.message : "Connection failed";
        }
        break;
      }

      case "ollama": {
        const endpoint = process.env.OLLAMA_ENDPOINT || "http://localhost:11434";
        try {
          const res = await fetch(`${endpoint}/api/tags`);
          success = res.ok;
          if (!success) {
            error = "Ollama not responding";
          }
        } catch (e) {
          error = e instanceof Error ? e.message : "Connection failed";
        }
        break;
      }

      default:
        error = "Unknown provider";
    }

    return NextResponse.json({ success, error: error || undefined });
  } catch (error) {
    console.error("[API /settings/llm/test] Error:", error);
    return NextResponse.json(
      { success: false, error: "Test failed" },
      { status: 500 }
    );
  }
}
