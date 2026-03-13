import { NormalizedTrace } from '@rag-doctor/types';

/**
 * Raw, unvalidated input to the ingestion pipeline.
 * Represents whatever JSON.parse returns from a trace file.
 */
type RawTraceInput = unknown;
/**
 * A single structured validation issue produced during schema validation.
 */
interface ValidationIssue {
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
interface ValidationErrorPayload {
    code: "INVALID_TRACE_SCHEMA";
    message: string;
    issues: ValidationIssue[];
}
/**
 * Result of a successful ingestion — the fully validated and normalized trace.
 */
type IngestionResult = NormalizedTrace;

/**
 * The shared ingestion pipeline for both CLI commands and future SDK consumers.
 *
 * Accepts arbitrary parsed JSON input, runs full schema validation, then
 * produces a canonical `NormalizedTrace`. Both steps are pure and deterministic.
 *
 * Error taxonomy:
 * - `TraceValidationError` — schema shape is invalid (field-level issues attached)
 * - `TraceNormalizationError` — post-validation normalization encountered an
 *    irrecoverable inconsistency (should be rare given a passing validation)
 *
 * The caller is responsible for JSON parsing; `TraceParseError` is provided
 * for wrappers that also handle the JSON.parse step.
 *
 * @example
 * ```ts
 * import { ingestTrace } from "@rag-doctor/ingestion";
 *
 * const raw = JSON.parse(fs.readFileSync("trace.json", "utf-8"));
 * const trace = ingestTrace(raw); // throws TraceValidationError on bad input
 * const result = analyzeTrace(trace);
 * ```
 *
 * @throws {TraceValidationError} when the input does not match the trace schema
 * @throws {TraceNormalizationError} when a validated trace cannot be normalized
 */
declare function ingestTrace(input: RawTraceInput): NormalizedTrace;

/**
 * Validates an unknown value against the required trace schema.
 *
 * This is a pure, deterministic function: given the same input it always
 * produces the same result. It collects ALL issues before throwing so the
 * caller gets a complete error report rather than one issue at a time.
 *
 * @throws {TraceValidationError} when one or more schema violations are found.
 */
declare function validateTrace(input: unknown): void;

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
declare function normalizeTrace(input: unknown): NormalizedTrace;

/**
 * Thrown when the raw input cannot be parsed as JSON.
 * The CLI or SDK consumer is responsible for catching this before
 * passing data to the ingestion pipeline.
 *
 * @example
 * ```ts
 * try {
 *   const parsed = JSON.parse(raw);
 * } catch {
 *   throw new TraceParseError("Could not parse trace file as JSON", raw);
 * }
 * ```
 */
declare class TraceParseError extends Error {
    /** The raw string that failed to parse */
    readonly rawInput: string;
    readonly code: "TRACE_PARSE_ERROR";
    constructor(message: string, 
    /** The raw string that failed to parse */
    rawInput: string);
}
/**
 * Thrown when the parsed JSON object does not conform to the trace schema.
 * Carries structured field-level issues for user-friendly display.
 *
 * @example
 * ```ts
 * if (issues.length > 0) {
 *   throw new TraceValidationError("Trace validation failed", issues);
 * }
 * ```
 */
declare class TraceValidationError extends Error {
    readonly code: "TRACE_VALIDATION_ERROR";
    /** Structured issues array for programmatic consumption */
    readonly issues: ValidationIssue[];
    constructor(message: string, issues: ValidationIssue[]);
    /** Returns a structured payload suitable for JSON output */
    toPayload(): ValidationErrorPayload;
}
/**
 * Thrown when a structurally valid trace cannot be safely normalized
 * into canonical form (e.g. irrecoverable inconsistency in values).
 *
 * Under normal circumstances normalization is lenient and tolerant,
 * so this error should be rare. It indicates a hard inconsistency
 * that cannot be handled silently.
 */
declare class TraceNormalizationError extends Error {
    /** The field path that caused the normalization failure */
    readonly field?: string | undefined;
    readonly code: "TRACE_NORMALIZATION_ERROR";
    constructor(message: string, 
    /** The field path that caused the normalization failure */
    field?: string | undefined);
}

export { type IngestionResult, type RawTraceInput, TraceNormalizationError, TraceParseError, TraceValidationError, type ValidationErrorPayload, type ValidationIssue, ingestTrace, normalizeTrace, validateTrace };
