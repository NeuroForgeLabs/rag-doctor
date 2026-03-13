/**
 * A single chunk retrieved from a vector store or search index.
 */
interface RetrievedChunk {
    /** Unique identifier for the chunk */
    id: string;
    /** The raw text content of the chunk */
    text: string;
    /** Relevance score returned by the retrieval system (0–1 range typical) */
    score?: number;
    /** Source document or file reference */
    source?: string;
}
/**
 * A normalized representation of a single RAG pipeline execution.
 */
interface NormalizedTrace {
    /** The original user query */
    query: string;
    /** All chunks retrieved for the query */
    retrievedChunks: RetrievedChunk[];
    /** The final generated answer, if available */
    finalAnswer?: string;
    /** Optional metadata about the trace (model names, timestamps, etc.) */
    metadata?: Record<string, unknown>;
}
/**
 * Severity levels for diagnostic findings.
 */
type Severity = "low" | "medium" | "high";
/**
 * A single diagnostic finding produced by a rule.
 */
interface DiagnosticFinding {
    /** The rule identifier that produced this finding */
    ruleId: string;
    /** Human-readable rule name */
    ruleName: string;
    /** Severity of the finding */
    severity: Severity;
    /** Short description of the issue found */
    message: string;
    /** Actionable recommendation for resolving the issue */
    recommendation?: string;
    /** Optional structured data related to the finding */
    details?: Record<string, unknown>;
}
/**
 * A diagnostic rule that can be run against a NormalizedTrace.
 */
interface DiagnosticRule {
    /** Unique rule identifier (e.g. "duplicate-chunks") */
    id: string;
    /** Human-readable rule name */
    name: string;
    /** Execute the rule and return zero or more findings */
    run(trace: NormalizedTrace): DiagnosticFinding[];
}
/**
 * Summary of finding counts grouped by severity.
 */
interface SeveritySummary {
    high: number;
    medium: number;
    low: number;
}
/**
 * The complete result returned by the core analysis engine.
 */
interface AnalysisResult {
    /** All findings produced by all rules */
    findings: DiagnosticFinding[];
    /** Aggregated counts per severity */
    summary: SeveritySummary;
}
/**
 * A factory function that creates a DiagnosticRule, optionally with custom options.
 * The options type parameter `O` is the rule-specific options interface.
 */
type RuleFactory<O extends Record<string, unknown> = Record<string, unknown>> = (options?: Partial<O>) => DiagnosticRule;
/**
 * Per-rule runtime options passed to analyzeTrace.
 * Keys are rule IDs; values are partial options specific to that rule.
 */
type RuleOptions = Record<string, Record<string, unknown>>;
/**
 * A named, reusable collection of rule factories that resolves to an
 * executable rule set. Rule packs are the primary way to configure
 * analysis presets (e.g. "recommended", "strict").
 */
interface RulePack {
    /** Unique pack name (e.g. "recommended", "strict") */
    name: string;
    /** Human-readable description */
    description: string;
    /**
     * Resolves this pack into a concrete array of executable DiagnosticRules.
     * Accepts optional per-rule overrides that are layered on top of pack defaults.
     */
    resolve(ruleOptions?: RuleOptions): DiagnosticRule[];
}
/**
 * The validated, resolved configuration used by the analysis engine.
 * Produced by resolveAnalysisConfig() inside @rag-doctor/core.
 */
interface ResolvedAnalysisConfig {
    /** The final list of rules to run, in execution order */
    rules: DiagnosticRule[];
}

export type { AnalysisResult, DiagnosticFinding, DiagnosticRule, NormalizedTrace, ResolvedAnalysisConfig, RetrievedChunk, RuleFactory, RuleOptions, RulePack, Severity, SeveritySummary };
