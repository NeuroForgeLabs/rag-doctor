import type { DiagnosticFinding, DiagnosticRule, NormalizedTrace } from "@rag-doctor/types";
import { RuleConfigurationError } from "./errors.js";

/** Configurable options for the OversizedChunkRule */
export interface OversizedChunkOptions {
  /**
   * Maximum character length above which a chunk is considered oversized.
   * Must be a positive integer.
   * @default 1200
   */
  maxChunkLength: number;
}

const DEFAULTS: OversizedChunkOptions = {
  maxChunkLength: 1200,
};

/**
 * Validates OversizedChunkOptions and throws RuleConfigurationError on invalid values.
 */
function validateOptions(opts: OversizedChunkOptions): void {
  if (!Number.isInteger(opts.maxChunkLength) || opts.maxChunkLength < 1) {
    throw new RuleConfigurationError(
      "oversized-chunk",
      "maxChunkLength",
      "must be a positive integer",
    );
  }
}

/**
 * Creates an OversizedChunkRule with the given options.
 * Options are merged with defaults — only overridden fields need to be specified.
 *
 * @throws {RuleConfigurationError} if options fail validation
 */
export function createOversizedChunkRule(
  options?: Partial<OversizedChunkOptions>,
): DiagnosticRule {
  const opts: OversizedChunkOptions = { ...DEFAULTS, ...options };
  validateOptions(opts);

  const maxLength = opts.maxChunkLength;

  return {
    id: "oversized-chunk",
    name: "Oversized Chunk",

    run(trace: NormalizedTrace): DiagnosticFinding[] {
      const oversized = trace.retrievedChunks.filter((c) => c.text.length > maxLength);

      if (oversized.length === 0) {
        return [];
      }

      return [
        {
          ruleId: this.id,
          ruleName: this.name,
          severity: "low",
          message: `${oversized.length} chunk(s) exceed ${maxLength} characters. Large chunks reduce retrieval precision and inflate token usage.`,
          recommendation:
            "Split large documents into smaller overlapping chunks (200–500 tokens recommended). Use a recursive character splitter or semantic splitter.",
          details: {
            threshold: maxLength,
            oversizedChunks: oversized.map((c) => ({
              id: c.id,
              length: c.text.length,
              source: c.source,
            })),
          },
        },
      ];
    },
  };
}

/**
 * Default OversizedChunkRule instance (maxChunkLength: 1200).
 * Preserved for backward compatibility.
 */
export const OversizedChunkRule: DiagnosticRule = createOversizedChunkRule();
