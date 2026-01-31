/**
 * Document Extractor for Debate Arena
 *
 * Handles PDF upload, URL fetch, and text extraction
 */

import { extractText } from "unpdf";

export interface ExtractionResult {
  content: string;
  source: "pdf" | "url" | "text";
  name?: string;
  pageCount?: number;
  wordCount: number;
  error?: string;
}

/**
 * Extract text from a PDF buffer
 */
export async function extractPdfText(buffer: Buffer | Uint8Array): Promise<ExtractionResult> {
  try {
    const uint8Array = buffer instanceof Buffer ? new Uint8Array(buffer) : buffer;
    const result = await extractText(uint8Array, { mergePages: true });
    const content = cleanText(result.text);

    return {
      content,
      source: "pdf",
      pageCount: result.totalPages,
      wordCount: countWords(content),
    };
  } catch (error) {
    return {
      content: "",
      source: "pdf",
      wordCount: 0,
      error: `Failed to extract PDF text: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Fetch and extract content from a URL
 */
export async function extractFromUrl(url: string): Promise<ExtractionResult> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; DebateArena/1.0)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "";
    const urlObj = new URL(url);
    const name = urlObj.hostname + urlObj.pathname;

    // Handle PDF URLs
    if (contentType.includes("application/pdf")) {
      const buffer = await response.arrayBuffer();
      const result = await extractPdfText(Buffer.from(buffer));
      return { ...result, name };
    }

    // Handle HTML
    const html = await response.text();
    const content = extractTextFromHtml(html);

    return {
      content: cleanText(content),
      source: "url",
      name,
      wordCount: countWords(content),
    };
  } catch (error) {
    return {
      content: "",
      source: "url",
      wordCount: 0,
      error: `Failed to fetch URL: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Process plain text input
 */
export function processTextInput(text: string, name?: string): ExtractionResult {
  const content = cleanText(text);
  return {
    content,
    source: "text",
    name: name || "Pasted Text",
    wordCount: countWords(content),
  };
}

/**
 * Extract readable text from HTML
 */
function extractTextFromHtml(html: string): string {
  // Remove script and style tags
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  // Remove HTML comments
  text = text.replace(/<!--[\s\S]*?-->/g, "");

  // Replace block elements with newlines
  text = text.replace(/<\/(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, "\n");
  text = text.replace(/<(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, "\n");

  // Remove remaining tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode HTML entities
  text = decodeHtmlEntities(text);

  return text;
}

/**
 * Decode common HTML entities
 */
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    "&nbsp;": " ",
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": '"',
    "&#39;": "'",
    "&apos;": "'",
    "&mdash;": "—",
    "&ndash;": "–",
    "&hellip;": "...",
    "&copy;": "©",
    "&reg;": "®",
    "&trade;": "™",
  };

  let result = text;
  for (const [entity, char] of Object.entries(entities)) {
    result = result.replace(new RegExp(entity, "gi"), char);
  }

  // Handle numeric entities
  result = result.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)));
  result = result.replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));

  return result;
}

/**
 * Clean and normalize text
 */
function cleanText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

/**
 * Truncate text to max length preserving word boundaries
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const lastSpace = text.lastIndexOf(" ", maxLength);
  if (lastSpace === -1) return text.substring(0, maxLength);

  return text.substring(0, lastSpace) + "...";
}

/**
 * Extract lead paragraphs from document
 */
export function extractLeadParagraphs(text: string, maxParagraphs = 3): string {
  const paragraphs = text.split(/\n\n+/);
  return paragraphs.slice(0, maxParagraphs).join("\n\n");
}
