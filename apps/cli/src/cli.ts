import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { analyzeTrace, UnknownPackError, RuleConfigurationError } from "@rag-doctor/core";
import { diagnoseTrace } from "@rag-doctor/diagnostics";
import {
  ingestTrace,
  TraceValidationError,
  TraceParseError,
} from "@rag-doctor/ingestion";
import {
  adaptTrace,
  UnsupportedTraceFormatError,
  AdapterInputError,
} from "@rag-doctor/adapters";
import type { TraceFormat } from "@rag-doctor/adapters";
import { printTerminalReport, printDiagnosisReport } from "@rag-doctor/reporters";
import type { AnalysisResult, RuleOptions } from "@rag-doctor/types";
import type { AnalyzeOptions } from "@rag-doctor/core";
import type { DiagnosisResult } from "@rag-doctor/diagnostics";

// ── I/O interface (injectable for testing) ────────────────────────────────────

export interface CliIO {
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
export class CliExitError extends Error {
  constructor(public readonly code: number) {
    super(`CLI exited with code ${code}`);
    this.name = "CliExitError";
  }
}

/**
 * Production I/O that talks directly to the real process streams.
 */
export const processIO: CliIO = {
  stdout: (line) => process.stdout.write(line + "\n"),
  stderr: (line) => process.stderr.write(line + "\n"),
  exit: (code) => process.exit(code),
};

// ── Config file types ─────────────────────────────────────────────────────────

export interface RagDoctorConfig {
  packs?: string[];
  ruleOptions?: RuleOptions;
}

// ── Argument parsing ──────────────────────────────────────────────────────────

const VALID_FORMATS = new Set<string>(["canonical", "event-trace", "langchain", "langsmith"]);

interface CliFlags {
  json: boolean;
  help: boolean;
  config: string | null;
  format: string | null;
  unknownFlags: string[];
}

export function parseArgs(args: string[]): { flags: CliFlags; positional: string[] } {
  const flags: CliFlags = { json: false, help: false, config: null, format: null, unknownFlags: [] };
  const positional: string[] = [];

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === undefined) { i++; continue; }

    if (arg === "--json") {
      flags.json = true;
    } else if (arg === "--help" || arg === "-h") {
      flags.help = true;
    } else if (arg === "--config") {
      const next = args[i + 1];
      if (!next || next.startsWith("--")) {
        flags.unknownFlags.push("--config (missing value)");
      } else {
        flags.config = next;
        i++;
      }
    } else if (arg.startsWith("--config=")) {
      flags.config = arg.slice("--config=".length);
    } else if (arg === "--format") {
      const next = args[i + 1];
      if (!next || next.startsWith("--")) {
        flags.unknownFlags.push("--format (missing value)");
      } else {
        flags.format = next;
        i++;
      }
    } else if (arg.startsWith("--format=")) {
      flags.format = arg.slice("--format=".length);
    } else if (arg.startsWith("--")) {
      flags.unknownFlags.push(arg);
    } else {
      positional.push(arg);
    }
    i++;
  }

  return { flags, positional };
}

// ── Help text ─────────────────────────────────────────────────────────────────

export function buildHelpText(): string {
  return `
${bold("rag-doctor")} — Diagnose your RAG pipeline

${bold("USAGE")}
  rag-doctor analyze <traceFile> [flags]
  rag-doctor diagnose <traceFile> [flags]

${bold("COMMANDS")}
  analyze <traceFile>   Load a trace JSON and run diagnostics
  diagnose <traceFile>  Run diagnostics and infer root cause(s)

${bold("FLAGS")}
  --json                Output results as JSON instead of terminal report
  --config <file>       Path to a rule configuration JSON file
  --format <name>       Trace format: canonical, event-trace, langchain, langsmith
  --help, -h            Show this help message

${bold("EXAMPLES")}
  rag-doctor analyze trace.json
  rag-doctor analyze trace.json --json
  rag-doctor analyze trace.json --config rag-doctor.config.json
  rag-doctor analyze langchain-trace.json --format langchain
  rag-doctor diagnose trace.json
  rag-doctor diagnose trace.json --format langsmith
  npx rag-doctor analyze trace.json

${bold("SUPPORTED TRACE FORMATS")}
  canonical     RAG Doctor native format (auto-detected)
  event-trace   Generic event-based RAG trace
  langchain     Simplified LangChain trace
  langsmith     Simplified LangSmith trace

  Formats are auto-detected when --format is omitted.

${bold("CONFIG FILE FORMAT")}
  {
    "packs": ["recommended"],
    "ruleOptions": {
      "low-retrieval-score": { "averageScoreThreshold": 0.6 },
      "context-overload": { "maxChunkCount": 8 }
    }
  }

${bold("BUILT-IN PACKS")}
  recommended   All rules with balanced defaults (default)
  strict        All rules with stricter thresholds

${bold("TRACE FORMAT")}
  {
    "query": "string",
    "retrievedChunks": [{ "id": "string", "text": "string", "score"?: number }],
    "finalAnswer"?: "string"
  }
`;
}

// ── Config loading ────────────────────────────────────────────────────────────

export function loadConfig(
  configPath: string | null,
  flags: CliFlags,
  io: CliIO,
): RagDoctorConfig | null {
  if (!configPath) return null;

  const absolutePath = resolve(process.cwd(), configPath);

  if (!existsSync(absolutePath)) {
    emitError(io, flags, "Config file not found", configPath);
    io.exit(1);
  }

  let rawContent: string;
  try {
    rawContent = readFileSync(absolutePath, "utf-8");
  } catch {
    emitError(io, flags, "Could not read config file", configPath);
    io.exit(1);
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(rawContent);
  } catch {
    if (flags.json) {
      io.stderr(JSON.stringify({ error: "CONFIG_PARSE_ERROR", file: configPath }, null, 2));
    } else {
      io.stderr(`Error: ${configPath} is not valid JSON.`);
    }
    io.exit(1);
  }

  return validateConfig(rawJson, configPath, flags, io);
}

function validateConfig(
  raw: unknown,
  configPath: string,
  flags: CliFlags,
  io: CliIO,
): RagDoctorConfig {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    const msg = "Config file must be a JSON object";
    if (flags.json) {
      io.stderr(JSON.stringify({ error: "CONFIG_SCHEMA_ERROR", message: msg, file: configPath }, null, 2));
    } else {
      io.stderr(`Error: ${msg}: ${configPath}`);
    }
    io.exit(1);
  }

  const obj = raw as Record<string, unknown>;
  const config: RagDoctorConfig = {};

  if (obj["packs"] !== undefined) {
    if (!Array.isArray(obj["packs"]) || !obj["packs"].every((p) => typeof p === "string")) {
      const msg = '"packs" must be an array of strings';
      if (flags.json) {
        io.stderr(JSON.stringify({ error: "CONFIG_SCHEMA_ERROR", message: msg }, null, 2));
      } else {
        io.stderr(`Error: Config schema error: ${msg}`);
      }
      io.exit(1);
    }
    config.packs = obj["packs"] as string[];
  }

  if (obj["ruleOptions"] !== undefined) {
    if (
      typeof obj["ruleOptions"] !== "object" ||
      obj["ruleOptions"] === null ||
      Array.isArray(obj["ruleOptions"])
    ) {
      const msg = '"ruleOptions" must be an object';
      if (flags.json) {
        io.stderr(JSON.stringify({ error: "CONFIG_SCHEMA_ERROR", message: msg }, null, 2));
      } else {
        io.stderr(`Error: Config schema error: ${msg}`);
      }
      io.exit(1);
    }
    config.ruleOptions = obj["ruleOptions"] as RuleOptions;
  }

  return config;
}

// ── Shared ingestion pipeline ─────────────────────────────────────────────────

/**
 * Reads a trace file from disk, optionally adapts it from an external format,
 * runs the ingestion pipeline, then runs analysis with the resolved rule configuration.
 */
function loadAndAnalyze(
  filePath: string,
  flags: CliFlags,
  io: CliIO,
  analyzeOptions: AnalyzeOptions,
): AnalysisResult {
  const absolutePath = resolve(process.cwd(), filePath);

  if (!existsSync(absolutePath)) {
    emitError(io, flags, "File not found", filePath);
    io.exit(1);
  }

  let rawContent: string;
  try {
    rawContent = readFileSync(absolutePath, "utf-8");
  } catch {
    emitError(io, flags, "Could not read file", filePath);
    io.exit(1);
  }

  let rawJson: unknown;
  try {
    rawJson = JSON.parse(rawContent);
  } catch {
    const parseErr = new TraceParseError(`${filePath} is not valid JSON.`, rawContent);
    if (flags.json) {
      io.stderr(
        JSON.stringify({ error: "TRACE_PARSE_ERROR", message: parseErr.message }, null, 2),
      );
    } else {
      io.stderr(`Error: ${parseErr.message}`);
    }
    io.exit(1);
  }

  // Adapter layer: convert external formats → canonical raw trace.
  // When --format is explicit, always run the adapter (errors are fatal).
  // When auto-detecting, skip the adapter layer for "unknown" formats and let
  // ingestion handle validation — this preserves backward-compatible error messages.
  let traceInput: unknown = rawJson;
  if (flags.format) {
    try {
      const adapted = adaptTrace(rawJson, { format: flags.format as TraceFormat });
      traceInput = adapted.trace;
      if (!flags.json && adapted.format !== "canonical") {
        io.stderr(`Adapted trace format: ${adapted.format}`);
      }
    } catch (err) {
      if (err instanceof UnsupportedTraceFormatError) {
        if (flags.json) {
          io.stderr(JSON.stringify({ error: "UNSUPPORTED_TRACE_FORMAT", message: err.message }, null, 2));
        } else {
          io.stderr(`Error: ${err.message}`);
        }
        io.exit(1);
      }
      if (err instanceof AdapterInputError) {
        if (flags.json) {
          io.stderr(JSON.stringify({ error: "ADAPTER_INPUT_ERROR", adapter: err.adapter, message: err.message }, null, 2));
        } else {
          io.stderr(`Error: ${err.message}`);
        }
        io.exit(1);
      }
      throw err;
    }
  } else {
    try {
      const adapted = adaptTrace(rawJson);
      traceInput = adapted.trace;
      if (!flags.json && adapted.format !== "canonical") {
        io.stderr(`Adapted trace format: ${adapted.format}`);
      }
    } catch {
      // Auto-detection failed — pass raw input to ingestion for proper validation
    }
  }

  // Ingestion: validate + normalize
  let trace;
  try {
    trace = ingestTrace(traceInput);
  } catch (err) {
    if (err instanceof TraceValidationError) {
      if (flags.json) {
        io.stderr(JSON.stringify(err.toPayload(), null, 2));
      } else {
        const issueLines = err.issues
          .map((i) => `  • ${i.path}: expected ${i.expected}, got ${i.received}`)
          .join("\n");
        io.stderr(
          `Error: Invalid trace format: ${err.message}${issueLines ? "\n" + issueLines : ""}`,
        );
      }
      io.exit(1);
    }
    throw err;
  }

  // Analysis
  try {
    return analyzeTrace(trace, analyzeOptions);
  } catch (err) {
    if (err instanceof UnknownPackError) {
      if (flags.json) {
        io.stderr(JSON.stringify({ error: "UNKNOWN_PACK_ERROR", message: err.message }, null, 2));
      } else {
        io.stderr(`Error: ${err.message}`);
      }
      io.exit(1);
    }
    if (err instanceof RuleConfigurationError) {
      if (flags.json) {
        io.stderr(
          JSON.stringify(
            {
              error: "RULE_CONFIGURATION_ERROR",
              ruleId: err.ruleId,
              optionKey: err.optionKey,
              message: err.message,
            },
            null,
            2,
          ),
        );
      } else {
        io.stderr(`Error: ${err.message}`);
      }
      io.exit(1);
    }
    throw err;
  }
}

function emitError(io: CliIO, flags: CliFlags, message: string, filePath: string): void {
  if (flags.json) {
    io.stderr(JSON.stringify({ error: message, file: filePath }, null, 2));
  } else {
    io.stderr(`Error: ${message}: ${filePath}`);
  }
}

// ── Analyze command ───────────────────────────────────────────────────────────

export function runAnalyzeCommand(
  filePath: string,
  flags: CliFlags,
  io: CliIO,
  analyzeOptions: AnalyzeOptions = {},
): AnalysisResult {
  const result = loadAndAnalyze(filePath, flags, io, analyzeOptions);

  if (flags.json) {
    io.stdout(JSON.stringify(result, null, 2));
    return result;
  }

  printTerminalReport(result, { write: io.stdout });

  if (result.summary.high > 0) {
    io.exit(1);
  }

  return result;
}

// ── Diagnose command ──────────────────────────────────────────────────────────

export function runDiagnoseCommand(
  filePath: string,
  flags: CliFlags,
  io: CliIO,
  analyzeOptions: AnalyzeOptions = {},
): DiagnosisResult {
  const analysisResult = loadAndAnalyze(filePath, flags, io, analyzeOptions);
  const diagnosis = diagnoseTrace(analysisResult);

  if (flags.json) {
    io.stdout(JSON.stringify(diagnosis, null, 2));
    return diagnosis;
  }

  printDiagnosisReport(diagnosis, { write: io.stdout });

  if (analysisResult.summary.high > 0) {
    io.exit(1);
  }

  return diagnosis;
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function run(argv: string[] = process.argv.slice(2), io: CliIO = processIO): void {
  const { flags, positional } = parseArgs(argv);

  // Validate --format value before treating it as unknown flag
  if (flags.format !== null && !VALID_FORMATS.has(flags.format)) {
    const available = [...VALID_FORMATS].join(", ");
    if (flags.json) {
      io.stderr(JSON.stringify({ error: "INVALID_FORMAT", format: flags.format, available }, null, 2));
    } else {
      io.stderr(`Error: Unknown trace format "${flags.format}". Supported: ${available}`);
    }
    io.exit(1);
  }

  if (flags.unknownFlags.length > 0) {
    io.stderr(
      `Error: Unknown flag(s): ${flags.unknownFlags.join(", ")}. Run rag-doctor --help for usage.`,
    );
    io.exit(1);
  }

  if (flags.help || positional.length === 0) {
    io.stdout(buildHelpText());
    return;
  }

  const command = positional[0];

  const config = loadConfig(flags.config, flags, io);
  const analyzeOptions: AnalyzeOptions = {};
  if (config?.packs !== undefined) analyzeOptions.packs = config.packs;
  if (config?.ruleOptions !== undefined) analyzeOptions.ruleOptions = config.ruleOptions;

  switch (command) {
    case "analyze": {
      const filePath = positional[1];
      if (!filePath) {
        io.stderr(
          'Error: The "analyze" command requires a trace file path.\n  Usage: rag-doctor analyze <traceFile>',
        );
        io.exit(1);
      }
      runAnalyzeCommand(filePath, flags, io, analyzeOptions);
      break;
    }
    case "diagnose": {
      const filePath = positional[1];
      if (!filePath) {
        io.stderr(
          'Error: The "diagnose" command requires a trace file path.\n  Usage: rag-doctor diagnose <traceFile>',
        );
        io.exit(1);
      }
      runDiagnoseCommand(filePath, flags, io, analyzeOptions);
      break;
    }
    default:
      io.stderr(
        `Error: Unknown command: "${command}". Run rag-doctor --help for usage.`,
      );
      io.exit(1);
  }
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function bold(s: string): string {
  return `\x1b[1m${s}\x1b[0m`;
}
