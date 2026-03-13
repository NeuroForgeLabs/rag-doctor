export { analyzeTrace } from "./engine.js";
export type { AnalyzeOptions } from "./engine.js";

// Re-export types for convenience so consumers only need to import from @rag-doctor/core
export type {
  AnalysisResult,
  DiagnosticFinding,
  DiagnosticRule,
  NormalizedTrace,
  RetrievedChunk,
  Severity,
  SeveritySummary,
} from "@rag-doctor/types";
