/**
 * Event Emitter for SSE streaming
 */

import type { DebateEvent, DebateEventType } from "../agents/types";

type EventCallback = (event: DebateEvent) => void;

class DebateEventEmitter {
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private eventBuffer: Map<string, DebateEvent[]> = new Map();
  private readonly maxBufferSize = 100;

  /**
   * Subscribe to events for a specific debate
   */
  subscribe(debateId: string, callback: EventCallback): () => void {
    if (!this.listeners.has(debateId)) {
      this.listeners.set(debateId, new Set());
    }
    this.listeners.get(debateId)!.add(callback);

    // Send buffered events to new subscriber
    const buffered = this.eventBuffer.get(debateId) || [];
    for (const event of buffered) {
      callback(event);
    }

    // Return unsubscribe function
    return () => {
      const listeners = this.listeners.get(debateId);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          this.listeners.delete(debateId);
        }
      }
    };
  }

  /**
   * Emit an event to all subscribers
   */
  emit(debateId: string, type: DebateEventType, data: DebateEvent["data"]): void {
    const event: DebateEvent = {
      type,
      timestamp: new Date(),
      data: { ...data, debateId },
    };

    // Buffer the event
    if (!this.eventBuffer.has(debateId)) {
      this.eventBuffer.set(debateId, []);
    }
    const buffer = this.eventBuffer.get(debateId)!;
    buffer.push(event);
    if (buffer.length > this.maxBufferSize) {
      buffer.shift();
    }

    // Notify listeners
    const listeners = this.listeners.get(debateId);
    if (listeners) {
      for (const callback of listeners) {
        try {
          callback(event);
        } catch (error) {
          console.error("[EventEmitter] Error in callback:", error);
        }
      }
    }
  }

  /**
   * Clear event buffer for a debate
   */
  clearBuffer(debateId: string): void {
    this.eventBuffer.delete(debateId);
  }

  /**
   * Get buffered events for a debate
   */
  getBufferedEvents(debateId: string): DebateEvent[] {
    return this.eventBuffer.get(debateId) || [];
  }

  /**
   * Check if debate has active subscribers
   */
  hasSubscribers(debateId: string): boolean {
    const listeners = this.listeners.get(debateId);
    return listeners !== undefined && listeners.size > 0;
  }
}

// Global event emitter instance using globalThis to persist across module reloads
const globalForEvents = globalThis as unknown as {
  debateEventEmitter: DebateEventEmitter | undefined;
};

export const debateEventEmitter =
  globalForEvents.debateEventEmitter ?? new DebateEventEmitter();

if (process.env.NODE_ENV !== "production") {
  globalForEvents.debateEventEmitter = debateEventEmitter;
}

/**
 * Helper to create SSE response from event stream
 */
export function createSSEStream(debateId: string): ReadableStream {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      const unsubscribe = debateEventEmitter.subscribe(debateId, (event) => {
        const data = `data: ${JSON.stringify(event)}\n\n`;
        controller.enqueue(encoder.encode(data));
      });

      // Handle client disconnect
      const cleanup = () => {
        unsubscribe();
      };

      // Store cleanup for later
      (controller as unknown as { cleanup?: () => void }).cleanup = cleanup;
    },
    cancel() {
      // Called when client disconnects
    },
  });
}
