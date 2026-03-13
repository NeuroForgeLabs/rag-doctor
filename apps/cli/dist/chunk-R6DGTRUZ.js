#!/usr/bin/env node

// src/cli.ts
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { analyzeTrace, UnknownPackError, RuleConfigurationError } from "@rag-doctor/core";
import { diagnoseTrace } from "@rag-doctor/diagnostics";
import {
  ingestTrace,
  TraceValidationError,
  TraceParseError
} from "@rag-doctor/ingestion";
import {
  adaptTrace,
  UnsupportedTraceFormatError,
  AdapterInputError
} from "@rag-doctor/adapters";
import { printTerminalReport, printDiagnosisReport } from "@rag-doctor/reporters";
var CliExitError = class extends Error {
  constructor(code) {
    super(`CLI exited with code ${code}`);
    this.code = code;
    this.name = "CliExitError";
  }
};
var processIO = {
  stdout: (line) => process.stdout.write(line + "\n"),
  stderr: (line) => process.stderr.write(line + "\n"),
  exit: (code) => process.exit(code)
};
var VALID_FORMATS = /* @__PURE__ */ new Set(["canonical", "event-trace", "langchain", "langsmith"]);
function parseArgs(args) {
  const flags = { json: false, help: false, config: null, format: null, unknownFlags: [] };
  const positional = [];
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === void 0) {
      i++;
      continue;
    }
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
function buildHelpText() {
  return `
${bold("rag-doctor")} \u2014 Diagnose your RAG pipeline

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
function loadConfig(configPath, flags, io) {
  if (!configPath) return null;
  const absolutePath = resolve(process.cwd(), configPath);
  if (!existsSync(absolutePath)) {
    emitError(io, flags, "Config file not found", configPath);
    io.exit(1);
  }
  let rawContent;
  try {
    rawContent = readFileSync(absolutePath, "utf-8");
  } catch {
    emitError(io, flags, "Could not read config file", configPath);
    io.exit(1);
  }
  let rawJson;
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
function validateConfig(raw, configPath, flags, io) {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    const msg = "Config file must be a JSON object";
    if (flags.json) {
      io.stderr(JSON.stringify({ error: "CONFIG_SCHEMA_ERROR", message: msg, file: configPath }, null, 2));
    } else {
      io.stderr(`Error: ${msg}: ${configPath}`);
    }
    io.exit(1);
  }
  const obj = raw;
  const config = {};
  if (obj["packs"] !== void 0) {
    if (!Array.isArray(obj["packs"]) || !obj["packs"].every((p) => typeof p === "string")) {
      const msg = '"packs" must be an array of strings';
      if (flags.json) {
        io.stderr(JSON.stringify({ error: "CONFIG_SCHEMA_ERROR", message: msg }, null, 2));
      } else {
        io.stderr(`Error: Config schema error: ${msg}`);
      }
      io.exit(1);
    }
    config.packs = obj["packs"];
  }
  if (obj["ruleOptions"] !== void 0) {
    if (typeof obj["ruleOptions"] !== "object" || obj["ruleOptions"] === null || Array.isArray(obj["ruleOptions"])) {
      const msg = '"ruleOptions" must be an object';
      if (flags.json) {
        io.stderr(JSON.stringify({ error: "CONFIG_SCHEMA_ERROR", message: msg }, null, 2));
      } else {
        io.stderr(`Error: Config schema error: ${msg}`);
      }
      io.exit(1);
    }
    config.ruleOptions = obj["ruleOptions"];
  }
  return config;
}
function loadAndAnalyze(filePath, flags, io, analyzeOptions) {
  const absolutePath = resolve(process.cwd(), filePath);
  if (!existsSync(absolutePath)) {
    emitError(io, flags, "File not found", filePath);
    io.exit(1);
  }
  let rawContent;
  try {
    rawContent = readFileSync(absolutePath, "utf-8");
  } catch {
    emitError(io, flags, "Could not read file", filePath);
    io.exit(1);
  }
  let rawJson;
  try {
    rawJson = JSON.parse(rawContent);
  } catch {
    const parseErr = new TraceParseError(`${filePath} is not valid JSON.`, rawContent);
    if (flags.json) {
      io.stderr(
        JSON.stringify({ error: "TRACE_PARSE_ERROR", message: parseErr.message }, null, 2)
      );
    } else {
      io.stderr(`Error: ${parseErr.message}`);
    }
    io.exit(1);
  }
  let traceInput = rawJson;
  if (flags.format) {
    try {
      const adapted = adaptTrace(rawJson, { format: flags.format });
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
    }
  }
  let trace;
  try {
    trace = ingestTrace(traceInput);
  } catch (err) {
    if (err instanceof TraceValidationError) {
      if (flags.json) {
        io.stderr(JSON.stringify(err.toPayload(), null, 2));
      } else {
        const issueLines = err.issues.map((i) => `  \u2022 ${i.path}: expected ${i.expected}, got ${i.received}`).join("\n");
        io.stderr(
          `Error: Invalid trace format: ${err.message}${issueLines ? "\n" + issueLines : ""}`
        );
      }
      io.exit(1);
    }
    throw err;
  }
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
              message: err.message
            },
            null,
            2
          )
        );
      } else {
        io.stderr(`Error: ${err.message}`);
      }
      io.exit(1);
    }
    throw err;
  }
}
function emitError(io, flags, message, filePath) {
  if (flags.json) {
    io.stderr(JSON.stringify({ error: message, file: filePath }, null, 2));
  } else {
    io.stderr(`Error: ${message}: ${filePath}`);
  }
}
function runAnalyzeCommand(filePath, flags, io, analyzeOptions = {}) {
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
function runDiagnoseCommand(filePath, flags, io, analyzeOptions = {}) {
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
function run(argv = process.argv.slice(2), io = processIO) {
  const { flags, positional } = parseArgs(argv);
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
      `Error: Unknown flag(s): ${flags.unknownFlags.join(", ")}. Run rag-doctor --help for usage.`
    );
    io.exit(1);
  }
  if (flags.help || positional.length === 0) {
    io.stdout(buildHelpText());
    return;
  }
  const command = positional[0];
  const config = loadConfig(flags.config, flags, io);
  const analyzeOptions = {};
  if (config?.packs !== void 0) analyzeOptions.packs = config.packs;
  if (config?.ruleOptions !== void 0) analyzeOptions.ruleOptions = config.ruleOptions;
  switch (command) {
    case "analyze": {
      const filePath = positional[1];
      if (!filePath) {
        io.stderr(
          'Error: The "analyze" command requires a trace file path.\n  Usage: rag-doctor analyze <traceFile>'
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
          'Error: The "diagnose" command requires a trace file path.\n  Usage: rag-doctor diagnose <traceFile>'
        );
        io.exit(1);
      }
      runDiagnoseCommand(filePath, flags, io, analyzeOptions);
      break;
    }
    default:
      io.stderr(
        `Error: Unknown command: "${command}". Run rag-doctor --help for usage.`
      );
      io.exit(1);
  }
}
function bold(s) {
  return `\x1B[1m${s}\x1B[0m`;
}

export {
  CliExitError,
  parseArgs,
  buildHelpText,
  runAnalyzeCommand,
  runDiagnoseCommand,
  run
};
//# sourceMappingURL=chunk-R6DGTRUZ.js.map