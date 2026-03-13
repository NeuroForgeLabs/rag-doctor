import type { NormalizedTrace } from "@rag-doctor/types";

/**
 * Raw, unvalidated input to the ingestion pipeline.
 * Represents whatever JSON.parse returns from a trace file.
 */
export type RawTraceInput = unknown;

/**
 * A single structured validation issue produced during schema validation.
 */
export interface ValidationIssue {
  /** Dot-path to the offending field (e.g. "retrieval.chunks[1].score") */
  path: string;
  /** Human-readable description of what was expected */
  expected: string;
  /** Description of what was actually received */
  received: string;
}

/**
 * Structured validation error payload returned in typed errors.
 */
export interface ValidationErrorPayload {
  code: "INVALID_TRACE_SCHEMA";
  message: string;
  issues: ValidationIssue[];
}

/**
 * Result of a successful ingestion — the fully validated and normalized trace.
 */
export type IngestionResult = NormalizedTrace;
