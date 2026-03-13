import { AnalysisResult } from '@rag-doctor/types';
import { AnalyzeOptions } from '@rag-doctor/core';
import { DiagnosisResult } from '@rag-doctor/diagnostics';

interface CliIO {
    /** Write a line to stdout */
    stdout: (line: string) => void;
    /** Write a line to stderr */
    stderr: (line: string) => void;
    /** Terminate the process; in tests this throws CliExitError */
    exit: (code: number) => never;
}
/**
 * Thrown by test-mode exit() so test code can catch a controlled exit
 * without actually terminating the process.
 */
declare class CliExitError extends Error {
    readonly code: number;
    constructor(code: number);
}
interface CliFlags {
    json: boolean;
    help: boolean;
    config: string | null;
    format: string | null;
    unknownFlags: string[];
}
declare function parseArgs(args: string[]): {
    flags: CliFlags;
    positional: string[];
};
declare function buildHelpText(): string;
declare function runAnalyzeCommand(filePath: string, flags: CliFlags, io: CliIO, analyzeOptions?: AnalyzeOptions): AnalysisResult;
declare function runDiagnoseCommand(filePath: string, flags: CliFlags, io: CliIO, analyzeOptions?: AnalyzeOptions): DiagnosisResult;
declare function run(argv?: string[], io?: CliIO): void;

export { CliExitError, type CliIO, buildHelpText, parseArgs, run, runAnalyzeCommand, runDiagnoseCommand };
