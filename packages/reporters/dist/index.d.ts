import { AnalysisResult } from '@rag-doctor/types';
import { DiagnosisResult } from '@rag-doctor/diagnostics';

interface TerminalReportOptions {
    /**
     * Custom write function for output. Defaults to process.stdout.write.
     * Override this in tests to capture output.
     */
    write?: (line: string) => void;
}
/**
 * Prints a human-readable diagnostic report to the terminal.
 *
 * This function is intentionally pure — it accepts a write function so it
 * can be used in non-terminal environments (e.g. capturing output in tests).
 *
 * @example
 * ```ts
 * const result = analyzeTrace(trace);
 * printTerminalReport(result);
 * ```
 */
declare function printTerminalReport(result: AnalysisResult, options?: TerminalReportOptions): void;

interface DiagnosisReportOptions {
    /**
     * Custom write function for output. Defaults to process.stdout.write.
     * Override this in tests to capture output.
     */
    write?: (line: string) => void;
}
/**
 * Prints a human-readable diagnosis report to the terminal.
 *
 * This function is intentionally pure — it accepts a write function so it
 * can be used in non-terminal environments (e.g. capturing output in tests).
 *
 * @example
 * ```ts
 * const analysisResult = analyzeTrace(trace);
 * const diagnosis = diagnoseTrace(analysisResult);
 * printDiagnosisReport(diagnosis);
 * ```
 */
declare function printDiagnosisReport(result: DiagnosisResult, options?: DiagnosisReportOptions): void;

export { type DiagnosisReportOptions, type TerminalReportOptions, printDiagnosisReport, printTerminalReport };
