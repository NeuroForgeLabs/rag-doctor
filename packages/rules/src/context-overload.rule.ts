import type { DiagnosticFinding, DiagnosticRule, NormalizedTrace } from "@rag-doctor/types";
import { RuleConfigurationError } from "./errors.js";

/** Configurable options for the ContextOverloadRule */
export interface ContextOverloadOptions {
  /**
   * Maximum number of retrieved chunks above which a finding is produced.
   * Must be a positive integer.
   * @default 10
   */
  maxChunkCount: number;
}

const DEFAULTS: ContextOverloadOptions = {
  maxChunkCount: 10,
};

/**
 * Validates ContextOverloadOptions and throws RuleConfigurationError on invalid values.
 */
function validateOptions(opts: ContextOverloadOptions): void {
  if (!Number.isInteger(opts.maxChunkCount) || opts.maxChunkCount < 1) {
    throw new RuleConfigurationError(
      "context-overload",
      "maxChunkCount",
      "must be a positive integer",
    );
  }
}

/**
 * Creates a ContextOverloadRule with the given options.
 * Options are merged with defaults — only overridden fields need to be specified.
 *
 * @throws {RuleConfigurationError} if options fail validation
 */
export function createContextOverloadRule(
  options?: Partial<ContextOverloadOptions>,
): DiagnosticRule {
  const opts: ContextOverloadOptions = { ...DEFAULTS, ...options };
  validateOptions(opts);

  const maxCount = opts.maxChunkCount;

  return {
    id: "context-overload",
    name: "Context Overload",

    run(trace: NormalizedTrace): DiagnosticFinding[] {
      const count = trace.retrievedChunks.length;

      if (count <= maxCount) {
        return [];
      }

      return [
        {
          ruleId: this.id,
          ruleName: this.name,
          severity: "medium",
          message: `${count} chunks retrieved (threshold: ${maxCount}). Too many chunks can cause the LLM to lose focus on the most relevant content ("lost in the middle" problem).`,
          recommendation:
            "Reduce the top-k retrieval parameter or add a reranking step to select only the most relevant chunks before sending to the LLM.",
          details: {
            chunkCount: count,
            threshold: maxCount,
          },
        },
      ];
    },
  };
}

/**
 * Default ContextOverloadRule instance (maxChunkCount: 10).
 * Preserved for backward compatibility.
 */
export const ContextOverloadRule: DiagnosticRule = createContextOverloadRule();
