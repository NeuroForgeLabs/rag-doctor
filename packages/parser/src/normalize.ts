import type { NormalizedTrace, RetrievedChunk } from "@rag-doctor/types";
import { ParseError } from "./errors.js";

/**
 * Parses and validates a single chunk from raw input.
 */
function parseChunk(raw: unknown, index: number): RetrievedChunk {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ParseError(
      `retrievedChunks[${index}] must be an object, got ${typeof raw}`,
      `retrievedChunks[${index}]`,
    );
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj["id"] !== "string" || obj["id"].trim() === "") {
    throw new ParseError(
      `retrievedChunks[${index}].id must be a non-empty string`,
      `retrievedChunks[${index}].id`,
    );
  }

  if (typeof obj["text"] !== "string") {
    throw new ParseError(
      `retrievedChunks[${index}].text must be a string`,
      `retrievedChunks[${index}].text`,
    );
  }

  const chunk: RetrievedChunk = {
    id: obj["id"],
    text: obj["text"],
  };

  if (obj["score"] !== undefined) {
    if (typeof obj["score"] !== "number" || !isFinite(obj["score"])) {
      throw new ParseError(
        `retrievedChunks[${index}].score must be a finite number`,
        `retrievedChunks[${index}].score`,
      );
    }
    chunk.score = obj["score"];
  }

  if (obj["source"] !== undefined) {
    if (typeof obj["source"] !== "string") {
      throw new ParseError(
        `retrievedChunks[${index}].source must be a string`,
        `retrievedChunks[${index}].source`,
      );
    }
    chunk.source = obj["source"];
  }

  return chunk;
}

/**
 * Normalizes an arbitrary input object into a validated NormalizedTrace.
 *
 * @throws {ParseError} when required fields are missing or have invalid types.
 *
 * @example
 * ```ts
 * const trace = normalizeTrace(JSON.parse(fs.readFileSync("trace.json", "utf8")));
 * ```
 */
export function normalizeTrace(input: unknown): NormalizedTrace {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new ParseError(`Trace input must be a JSON object, got ${typeof input}`);
  }

  const raw = input as Record<string, unknown>;

  if (typeof raw["query"] !== "string" || raw["query"].trim() === "") {
    throw new ParseError('Trace must have a non-empty "query" string field', "query");
  }

  if (!Array.isArray(raw["retrievedChunks"])) {
    throw new ParseError(
      '"retrievedChunks" must be an array',
      "retrievedChunks",
    );
  }

  const retrievedChunks: RetrievedChunk[] = raw["retrievedChunks"].map((chunk, i) =>
    parseChunk(chunk, i),
  );

  const trace: NormalizedTrace = {
    query: raw["query"].trim(),
    retrievedChunks,
  };

  if (raw["finalAnswer"] !== undefined) {
    if (typeof raw["finalAnswer"] !== "string") {
      throw new ParseError('"finalAnswer" must be a string when present', "finalAnswer");
    }
    trace.finalAnswer = raw["finalAnswer"];
  }

  if (
    raw["metadata"] !== undefined &&
    typeof raw["metadata"] === "object" &&
    raw["metadata"] !== null &&
    !Array.isArray(raw["metadata"])
  ) {
    trace.metadata = raw["metadata"] as Record<string, unknown>;
  }

  return trace;
}
