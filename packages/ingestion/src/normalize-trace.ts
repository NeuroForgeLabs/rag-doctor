import type { NormalizedTrace, RetrievedChunk } from "@rag-doctor/types";
import { TraceNormalizationError } from "./errors.js";

/**
 * Normalizes a pre-validated raw object into a canonical NormalizedTrace.
 *
 * Precondition: the input MUST have already passed `validateTrace` without
 * throwing. This function trusts the shape but applies safe, deterministic
 * normalization rules:
 *
 * - Trims leading/trailing whitespace from `query`
 * - Defaults `retrievedChunks` to [] when not an array (defensive only)
 * - Preserves `score`, `source`, `finalAnswer`, `metadata` as-is
 * - Rejects score values outside the expected 0–1 range by treating them as
 *   valid (rules enforce threshold logic; normalization is non-destructive)
 *
 * @throws {TraceNormalizationError} on irrecoverable inconsistency (should be rare)
 */
export function normalizeTrace(input: unknown): NormalizedTrace {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new TraceNormalizationError(
      "Normalization received a non-object — ensure validateTrace is called first",
      "(root)",
    );
  }

  const raw = input as Record<string, unknown>;

  const query = raw["query"];
  if (typeof query !== "string") {
    throw new TraceNormalizationError("query must be a string after validation", "query");
  }

  const rawChunks = Array.isArray(raw["retrievedChunks"]) ? raw["retrievedChunks"] : [];
  const retrievedChunks: RetrievedChunk[] = rawChunks.map((chunk, i) =>
    normalizeChunk(chunk, i),
  );

  const trace: NormalizedTrace = {
    query: query.trim(),
    retrievedChunks,
  };

  if (raw["finalAnswer"] !== undefined && raw["finalAnswer"] !== null) {
    if (typeof raw["finalAnswer"] !== "string") {
      throw new TraceNormalizationError(
        "finalAnswer must be a string after validation",
        "finalAnswer",
      );
    }
    trace.finalAnswer = raw["finalAnswer"];
  }

  if (
    raw["metadata"] !== undefined &&
    raw["metadata"] !== null &&
    typeof raw["metadata"] === "object" &&
    !Array.isArray(raw["metadata"])
  ) {
    trace.metadata = raw["metadata"] as Record<string, unknown>;
  }

  return trace;
}

/**
 * Normalizes a single chunk from raw input.
 * Assumes the chunk has already been validated.
 */
function normalizeChunk(raw: unknown, index: number): RetrievedChunk {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new TraceNormalizationError(
      `retrievedChunks[${index}] must be an object — ensure validateTrace is called first`,
      `retrievedChunks[${index}]`,
    );
  }

  const obj = raw as Record<string, unknown>;

  const id = obj["id"];
  if (typeof id !== "string") {
    throw new TraceNormalizationError(
      `retrievedChunks[${index}].id must be a string after validation`,
      `retrievedChunks[${index}].id`,
    );
  }

  const text = obj["text"];
  if (typeof text !== "string") {
    throw new TraceNormalizationError(
      `retrievedChunks[${index}].text must be a string after validation`,
      `retrievedChunks[${index}].text`,
    );
  }

  const chunk: RetrievedChunk = { id, text };

  if (obj["score"] !== undefined && obj["score"] !== null) {
    if (typeof obj["score"] === "number" && isFinite(obj["score"])) {
      chunk.score = obj["score"];
    }
  }

  if (obj["source"] !== undefined && obj["source"] !== null) {
    if (typeof obj["source"] === "string") {
      chunk.source = obj["source"];
    }
  }

  return chunk;
}
