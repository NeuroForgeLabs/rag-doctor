import type { TraceFormat } from "./adapter-types.js";

/**
 * Deterministic heuristic format detection.
 *
 * Inspects the top-level keys of the parsed JSON object to identify
 * the most likely trace format. Returns "unknown" if no format matches.
 *
 * Detection order (first match wins):
 * 1. canonical — has `query` AND `retrievedChunks`
 * 2. event-trace — has `events` array
 * 3. langchain — has `input` AND `retrieverOutput`
 * 4. langsmith — has `run_type` AND `inputs` AND `outputs`
 */
export function detectTraceFormat(input: unknown): TraceFormat {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return "unknown";
  }

  const obj = input as Record<string, unknown>;

  if ("query" in obj && "retrievedChunks" in obj) {
    return "canonical";
  }

  if ("events" in obj && Array.isArray(obj["events"])) {
    return "event-trace";
  }

  if ("input" in obj && "retrieverOutput" in obj) {
    return "langchain";
  }

  if ("run_type" in obj && "inputs" in obj && "outputs" in obj) {
    return "langsmith";
  }

  return "unknown";
}
