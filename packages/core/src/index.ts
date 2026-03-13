export { analyzeTrace, resolveRules, UnknownPackError } from "./engine.js";
export type { AnalyzeOptions } from "./engine.js";

// Re-export RuleConfigurationError so consumers don't need to import from @rag-doctor/rules
export { RuleConfigurationError } from "@rag-doctor/rules";

// Re-export types for convenience so consumers only need to import from @rag-doctor/core
export type {
  AnalysisResult,
  DiagnosticFinding,
  DiagnosticRule,
  NormalizedTrace,
  ResolvedAnalysisConfig,
  RetrievedChunk,
  RuleOptions,
  RulePack,
  Severity,
  SeveritySummary,
} from "@rag-doctor/types";
