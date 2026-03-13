import type { TraceAdapter, AdaptedTraceResult } from "../adapter-types.js";
import { AdapterInputError } from "../errors.js";

interface EventItem {
  type: string;
  [key: string]: unknown;
}

/**
 * Event-trace adapter — converts a generic event-based trace format.
 *
 * Expected shape:
 * {
 *   events: [
 *     { type: "query.received", query: "..." },
 *     { type: "retrieval.completed", chunks: [...] },
 *     { type: "answer.generated", answer: "..." }
 *   ],
 *   metadata?: { ... }
 * }
 */
export const eventTraceAdapter: TraceAdapter = {
  format: "event-trace",
  name: "event-trace",

  adapt(input: unknown): AdaptedTraceResult {
    if (typeof input !== "object" || input === null || Array.isArray(input)) {
      throw new AdapterInputError("event-trace", "Input must be a JSON object.");
    }

    const obj = input as Record<string, unknown>;
    const warnings: string[] = [];

    if (!Array.isArray(obj["events"])) {
      throw new AdapterInputError("event-trace", '"events" must be an array.');
    }

    const events = obj["events"] as EventItem[];

    let query: string | undefined;
    let chunks: unknown[] | undefined;
    let finalAnswer: string | undefined;

    for (const event of events) {
      if (typeof event !== "object" || event === null) continue;

      switch (event["type"]) {
        case "query.received":
          if (typeof event["query"] === "string") {
            query = event["query"];
          }
          break;
        case "retrieval.completed":
          if (Array.isArray(event["chunks"])) {
            chunks = event["chunks"] as unknown[];
          }
          break;
        case "answer.generated":
          if (typeof event["answer"] === "string") {
            finalAnswer = event["answer"];
          }
          break;
      }
    }

    if (query === undefined) {
      throw new AdapterInputError("event-trace", 'No "query.received" event found with a query string.');
    }

    if (chunks === undefined) {
      throw new AdapterInputError("event-trace", 'No "retrieval.completed" event found with chunks.');
    }

    const existingMeta = typeof obj["metadata"] === "object" && obj["metadata"] !== null && !Array.isArray(obj["metadata"])
      ? (obj["metadata"] as Record<string, unknown>)
      : {};

    const trace: Record<string, unknown> = {
      query,
      retrievedChunks: chunks,
      metadata: { ...existingMeta, sourceFormat: "event-trace" },
    };

    if (finalAnswer !== undefined) {
      trace["finalAnswer"] = finalAnswer;
    } else {
      warnings.push("No 'answer.generated' event found; finalAnswer will be omitted.");
    }

    return {
      format: "event-trace",
      adapter: "event-trace",
      trace,
      warnings,
    };
  },
};
