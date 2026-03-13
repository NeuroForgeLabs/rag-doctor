import type { ValidationIssue, ValidationErrorPayload } from "./ingestion-types.js";

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
export class TraceParseError extends Error {
  public readonly code = "TRACE_PARSE_ERROR" as const;

  constructor(
    message: string,
    /** The raw string that failed to parse */
    public readonly rawInput: string,
  ) {
    super(message);
    this.name = "TraceParseError";
  }
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
export class TraceValidationError extends Error {
  public readonly code = "TRACE_VALIDATION_ERROR" as const;

  /** Structured issues array for programmatic consumption */
  public readonly issues: ValidationIssue[];

  constructor(
    message: string,
    issues: ValidationIssue[],
  ) {
    super(message);
    this.name = "TraceValidationError";
    this.issues = issues;
  }

  /** Returns a structured payload suitable for JSON output */
  toPayload(): ValidationErrorPayload {
    return {
      code: "INVALID_TRACE_SCHEMA",
      message: this.message,
      issues: this.issues,
    };
  }
}

/**
 * Thrown when a structurally valid trace cannot be safely normalized
 * into canonical form (e.g. irrecoverable inconsistency in values).
 *
 * Under normal circumstances normalization is lenient and tolerant,
 * so this error should be rare. It indicates a hard inconsistency
 * that cannot be handled silently.
 */
export class TraceNormalizationError extends Error {
  public readonly code = "TRACE_NORMALIZATION_ERROR" as const;

  constructor(
    message: string,
    /** The field path that caused the normalization failure */
    public readonly field?: string,
  ) {
    super(message);
    this.name = "TraceNormalizationError";
  }
}
