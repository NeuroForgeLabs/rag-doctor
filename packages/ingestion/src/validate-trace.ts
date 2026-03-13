import type { ValidationIssue } from "./ingestion-types.js";
import { TraceValidationError } from "./errors.js";

/**
 * Validates an unknown value against the required trace schema.
 *
 * This is a pure, deterministic function: given the same input it always
 * produces the same result. It collects ALL issues before throwing so the
 * caller gets a complete error report rather than one issue at a time.
 *
 * @throws {TraceValidationError} when one or more schema violations are found.
 */
export function validateTrace(input: unknown): void {
  const issues: ValidationIssue[] = [];

  // ── Root shape ────────────────────────────────────────────────────────────
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    issues.push({
      path: "(root)",
      expected: "object",
      received: Array.isArray(input) ? "array" : String(typeof input === "object" ? "null" : typeof input),
    });
    throw new TraceValidationError("Trace validation failed", issues);
  }

  const raw = input as Record<string, unknown>;

  // ── query ─────────────────────────────────────────────────────────────────
  if (raw["query"] === undefined || raw["query"] === null) {
    issues.push({ path: "query", expected: "non-empty string", received: "missing" });
  } else if (typeof raw["query"] !== "string") {
    issues.push({ path: "query", expected: "non-empty string", received: typeof raw["query"] });
  } else if (raw["query"].trim().length === 0) {
    issues.push({ path: "query", expected: "non-empty string", received: "empty string" });
  }

  // ── retrievedChunks ───────────────────────────────────────────────────────
  if (raw["retrievedChunks"] === undefined || raw["retrievedChunks"] === null) {
    issues.push({ path: "retrievedChunks", expected: "array", received: "missing" });
  } else if (!Array.isArray(raw["retrievedChunks"])) {
    issues.push({
      path: "retrievedChunks",
      expected: "array",
      received: typeof raw["retrievedChunks"],
    });
  } else {
    validateChunks(raw["retrievedChunks"], issues);
  }

  // ── finalAnswer (optional) ────────────────────────────────────────────────
  if (raw["finalAnswer"] !== undefined && raw["finalAnswer"] !== null) {
    if (typeof raw["finalAnswer"] !== "string") {
      issues.push({
        path: "finalAnswer",
        expected: "string",
        received: typeof raw["finalAnswer"],
      });
    }
  }

  // ── metadata (optional) ───────────────────────────────────────────────────
  if (raw["metadata"] !== undefined && raw["metadata"] !== null) {
    if (typeof raw["metadata"] !== "object" || Array.isArray(raw["metadata"])) {
      issues.push({
        path: "metadata",
        expected: "object",
        received: Array.isArray(raw["metadata"]) ? "array" : typeof raw["metadata"],
      });
    }
  }

  if (issues.length > 0) {
    throw new TraceValidationError("Trace validation failed", issues);
  }
}

/**
 * Validates each chunk entry in the retrievedChunks array.
 * Collects all issues rather than stopping at the first.
 */
function validateChunks(chunks: unknown[], issues: ValidationIssue[]): void {
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const prefix = `retrievedChunks[${i}]`;

    if (typeof chunk !== "object" || chunk === null || Array.isArray(chunk)) {
      issues.push({
        path: prefix,
        expected: "object",
        received: Array.isArray(chunk) ? "array" : String(chunk === null ? "null" : typeof chunk),
      });
      continue;
    }

    const obj = chunk as Record<string, unknown>;

    // id: required, non-empty string
    if (obj["id"] === undefined || obj["id"] === null) {
      issues.push({ path: `${prefix}.id`, expected: "non-empty string", received: "missing" });
    } else if (typeof obj["id"] !== "string") {
      issues.push({ path: `${prefix}.id`, expected: "non-empty string", received: typeof obj["id"] });
    } else if (obj["id"].trim().length === 0) {
      issues.push({ path: `${prefix}.id`, expected: "non-empty string", received: "empty string" });
    }

    // text: required string (may be empty — empty chunks are a valid finding)
    if (obj["text"] === undefined || obj["text"] === null) {
      issues.push({ path: `${prefix}.text`, expected: "string", received: "missing" });
    } else if (typeof obj["text"] !== "string") {
      issues.push({ path: `${prefix}.text`, expected: "string", received: typeof obj["text"] });
    }

    // score: optional, must be finite number when present
    if (obj["score"] !== undefined && obj["score"] !== null) {
      if (typeof obj["score"] !== "number") {
        issues.push({
          path: `${prefix}.score`,
          expected: "number",
          received: typeof obj["score"],
        });
      } else if (!isFinite(obj["score"])) {
        issues.push({
          path: `${prefix}.score`,
          expected: "finite number",
          received: String(obj["score"]),
        });
      }
    }

    // source: optional string when present
    if (obj["source"] !== undefined && obj["source"] !== null) {
      if (typeof obj["source"] !== "string") {
        issues.push({
          path: `${prefix}.source`,
          expected: "string",
          received: typeof obj["source"],
        });
      }
    }
  }
}
