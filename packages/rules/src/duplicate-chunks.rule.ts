import type { DiagnosticFinding, DiagnosticRule, NormalizedTrace } from "@rag-doctor/types";
import { RuleConfigurationError } from "./errors.js";

/** Configurable options for the DuplicateChunksRule */
export interface DuplicateChunksOptions {
  /**
   * Jaccard similarity threshold above which two chunks are considered duplicates.
   * Must be > 0 and <= 1.
   * @default 0.8
   */
  similarityThreshold: number;
}

const DEFAULTS: DuplicateChunksOptions = {
  similarityThreshold: 0.8,
};

/**
 * Computes the Jaccard similarity between two strings by tokenizing on whitespace.
 * Returns a value between 0 (no overlap) and 1 (identical token sets).
 */
function jaccardSimilarity(a: string, b: string): number {
  const tokenize = (s: string) =>
    new Set(s.toLowerCase().split(/\s+/).filter((t) => t.length > 0));

  const setA = tokenize(a);
  const setB = tokenize(b);

  const intersection = new Set([...setA].filter((t) => setB.has(t)));
  const union = new Set([...setA, ...setB]);

  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

/**
 * Validates DuplicateChunksOptions and throws RuleConfigurationError on invalid values.
 */
function validateOptions(opts: DuplicateChunksOptions): void {
  if (opts.similarityThreshold <= 0 || opts.similarityThreshold > 1) {
    throw new RuleConfigurationError(
      "duplicate-chunks",
      "similarityThreshold",
      "must be > 0 and <= 1",
    );
  }
}

/**
 * Creates a DuplicateChunksRule with the given options.
 * Options are merged with defaults — only overridden fields need to be specified.
 *
 * @throws {RuleConfigurationError} if options fail validation
 */
export function createDuplicateChunksRule(
  options?: Partial<DuplicateChunksOptions>,
): DiagnosticRule {
  const opts: DuplicateChunksOptions = { ...DEFAULTS, ...options };
  validateOptions(opts);

  const threshold = opts.similarityThreshold;

  return {
    id: "duplicate-chunks",
    name: "Duplicate Chunks",

    run(trace: NormalizedTrace): DiagnosticFinding[] {
      const findings: DiagnosticFinding[] = [];
      const chunks = trace.retrievedChunks;
      const duplicatePairs: Array<{ i: number; j: number; similarity: number }> = [];

      for (let i = 0; i < chunks.length; i++) {
        for (let j = i + 1; j < chunks.length; j++) {
          const chunkI = chunks[i];
          const chunkJ = chunks[j];
          if (!chunkI || !chunkJ) continue;

          const similarity = jaccardSimilarity(chunkI.text, chunkJ.text);
          if (similarity >= threshold) {
            duplicatePairs.push({ i, j, similarity });
          }
        }
      }

      if (duplicatePairs.length > 0) {
        findings.push({
          ruleId: this.id,
          ruleName: this.name,
          severity: "medium",
          message: `Found ${duplicatePairs.length} near-duplicate chunk pair(s). Redundant content wastes context window and dilutes relevance signals.`,
          recommendation:
            "Implement deduplication in your chunking pipeline or add a post-retrieval deduplication step (e.g. MMR, cosine dedup).",
          details: {
            duplicatePairs: duplicatePairs.map(({ i, j, similarity }) => ({
              chunkAId: chunks[i]?.id,
              chunkBId: chunks[j]?.id,
              similarity: Math.round(similarity * 100) / 100,
            })),
            threshold,
          },
        });
      }

      return findings;
    },
  };
}

/**
 * Default DuplicateChunksRule instance (similarityThreshold: 0.8).
 * Preserved for backward compatibility.
 */
export const DuplicateChunksRule: DiagnosticRule = createDuplicateChunksRule();
