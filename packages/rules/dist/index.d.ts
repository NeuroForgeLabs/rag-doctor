import { DiagnosticRule, RulePack } from '@rag-doctor/types';

/** Configurable options for the DuplicateChunksRule */
interface DuplicateChunksOptions {
    /**
     * Jaccard similarity threshold above which two chunks are considered duplicates.
     * Must be > 0 and <= 1.
     * @default 0.8
     */
    similarityThreshold: number;
}
/**
 * Creates a DuplicateChunksRule with the given options.
 * Options are merged with defaults — only overridden fields need to be specified.
 *
 * @throws {RuleConfigurationError} if options fail validation
 */
declare function createDuplicateChunksRule(options?: Partial<DuplicateChunksOptions>): DiagnosticRule;
/**
 * Default DuplicateChunksRule instance (similarityThreshold: 0.8).
 * Preserved for backward compatibility.
 */
declare const DuplicateChunksRule: DiagnosticRule;

/** Configurable options for the LowRetrievalScoreRule */
interface LowRetrievalScoreOptions {
    /**
     * Average score below which a HIGH finding is produced.
     * Must be >= 0 and <= 1.
     * @default 0.5
     */
    averageScoreThreshold: number;
}
/**
 * Creates a LowRetrievalScoreRule with the given options.
 * Options are merged with defaults — only overridden fields need to be specified.
 *
 * @throws {RuleConfigurationError} if options fail validation
 */
declare function createLowRetrievalScoreRule(options?: Partial<LowRetrievalScoreOptions>): DiagnosticRule;
/**
 * Default LowRetrievalScoreRule instance (averageScoreThreshold: 0.5).
 * Preserved for backward compatibility.
 */
declare const LowRetrievalScoreRule: DiagnosticRule;

/** Configurable options for the OversizedChunkRule */
interface OversizedChunkOptions {
    /**
     * Maximum character length above which a chunk is considered oversized.
     * Must be a positive integer.
     * @default 1200
     */
    maxChunkLength: number;
}
/**
 * Creates an OversizedChunkRule with the given options.
 * Options are merged with defaults — only overridden fields need to be specified.
 *
 * @throws {RuleConfigurationError} if options fail validation
 */
declare function createOversizedChunkRule(options?: Partial<OversizedChunkOptions>): DiagnosticRule;
/**
 * Default OversizedChunkRule instance (maxChunkLength: 1200).
 * Preserved for backward compatibility.
 */
declare const OversizedChunkRule: DiagnosticRule;

/** Configurable options for the ContextOverloadRule */
interface ContextOverloadOptions {
    /**
     * Maximum number of retrieved chunks above which a finding is produced.
     * Must be a positive integer.
     * @default 10
     */
    maxChunkCount: number;
}
/**
 * Creates a ContextOverloadRule with the given options.
 * Options are merged with defaults — only overridden fields need to be specified.
 *
 * @throws {RuleConfigurationError} if options fail validation
 */
declare function createContextOverloadRule(options?: Partial<ContextOverloadOptions>): DiagnosticRule;
/**
 * Default ContextOverloadRule instance (maxChunkCount: 10).
 * Preserved for backward compatibility.
 */
declare const ContextOverloadRule: DiagnosticRule;

/**
 * Thrown when rule configuration options fail validation.
 *
 * Reusable by CLI, SDK, and any future consumer that needs to
 * surface configuration problems in a typed, structured way.
 *
 * @example
 * ```ts
 * throw new RuleConfigurationError(
 *   "low-retrieval-score",
 *   "averageScoreThreshold",
 *   "must be between 0 and 1",
 * );
 * ```
 */
declare class RuleConfigurationError extends Error {
    /** The rule ID that has the bad option */
    readonly ruleId: string;
    /** The option key that is invalid */
    readonly optionKey: string;
    /** Human-readable description of the constraint violated */
    readonly constraint: string;
    readonly code: "RULE_CONFIGURATION_ERROR";
    constructor(
    /** The rule ID that has the bad option */
    ruleId: string, 
    /** The option key that is invalid */
    optionKey: string, 
    /** Human-readable description of the constraint violated */
    constraint: string);
}

/**
 * The "recommended" rule pack.
 *
 * Includes all four built-in rules with their default thresholds:
 * - duplicate-chunks:       similarityThreshold 0.8
 * - low-retrieval-score:    averageScoreThreshold 0.5
 * - oversized-chunk:        maxChunkLength 1200
 * - context-overload:       maxChunkCount 10
 */
declare const recommendedPack: RulePack;
/**
 * The "strict" rule pack.
 *
 * Same rules as "recommended" but with tighter thresholds:
 * - duplicate-chunks:       similarityThreshold 0.7  (catches more near-duplicates)
 * - low-retrieval-score:    averageScoreThreshold 0.6 (requires higher average relevance)
 * - oversized-chunk:        maxChunkLength 1000       (enforces smaller chunks)
 * - context-overload:       maxChunkCount 8           (limits retrieved chunks more aggressively)
 *
 * Per-rule overrides in ruleOptions are applied on top of these strict defaults,
 * not on top of the recommended defaults.
 */
declare const strictPack: RulePack;
/**
 * Registry of all built-in rule packs, keyed by pack name.
 */
declare const BUILT_IN_PACKS: Readonly<Record<string, RulePack>>;

/**
 * The default set of built-in diagnostic rules shipped with RAG Doctor.
 * All rules use their default thresholds.
 *
 * To customize thresholds, use the factory functions or rule packs instead:
 * @example
 * ```ts
 * import { createLowRetrievalScoreRule, recommendedPack } from "@rag-doctor/rules";
 *
 * // Custom threshold via factory
 * const strictScoreRule = createLowRetrievalScoreRule({ averageScoreThreshold: 0.6 });
 *
 * // Or use a named pack
 * const rules = recommendedPack.resolve({ "low-retrieval-score": { averageScoreThreshold: 0.6 } });
 * ```
 */
declare const defaultRules: DiagnosticRule[];

export { BUILT_IN_PACKS, type ContextOverloadOptions, ContextOverloadRule, type DuplicateChunksOptions, DuplicateChunksRule, type LowRetrievalScoreOptions, LowRetrievalScoreRule, type OversizedChunkOptions, OversizedChunkRule, RuleConfigurationError, createContextOverloadRule, createDuplicateChunksRule, createLowRetrievalScoreRule, createOversizedChunkRule, defaultRules, recommendedPack, strictPack };
