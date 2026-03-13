/**
 * In-process unit tests for the CLI.
 *
 * These tests import the CLI module directly and inject a mock CliIO,
 * so they run fast without spawning subprocesses.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { fileURLToPath } from "url";
import { join, dirname, resolve } from "path";
import { run, parseArgs, buildHelpText, runAnalyzeCommand, runDiagnoseCommand, CliExitError } from "../cli.js";
import type { CliIO } from "../cli.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// apps/cli/src/__tests__ → apps/cli/src → apps/cli → apps → rag-doctor/
const REPO_ROOT = resolve(__dirname, "../../../..");
const FIXTURES = join(REPO_ROOT, "tests", "fixtures");

// ── Test IO factory ───────────────────────────────────────────────────────────

interface TestOutput {
  stdout: string[];
  stderr: string[];
  exitCode: number | null;
}

function makeIO(): { io: CliIO; output: TestOutput } {
  const output: TestOutput = { stdout: [], stderr: [], exitCode: null };
  const io: CliIO = {
    stdout: (line) => output.stdout.push(line),
    stderr: (line) => output.stderr.push(line),
    exit: (code) => {
      output.exitCode = code;
      throw new CliExitError(code);
    },
  };
  return { io, output };
}

function runCli(argv: string[]): TestOutput {
  const { io, output } = makeIO();
  try {
    run(argv, io);
  } catch (err) {
    if (!(err instanceof CliExitError)) throw err;
  }
  return output;
}

function fixture(name: string): string {
  return join(FIXTURES, name);
}

// ── parseArgs ─────────────────────────────────────────────────────────────────

describe("parseArgs", () => {
  it("parses analyze command with a file path", () => {
    const { positional, flags } = parseArgs(["analyze", "trace.json"]);
    expect(positional).toEqual(["analyze", "trace.json"]);
    expect(flags.json).toBe(false);
    expect(flags.help).toBe(false);
  });

  it("parses --json flag", () => {
    const { flags } = parseArgs(["analyze", "trace.json", "--json"]);
    expect(flags.json).toBe(true);
  });

  it("parses --help flag", () => {
    const { flags } = parseArgs(["--help"]);
    expect(flags.help).toBe(true);
  });

  it("parses -h as help flag", () => {
    const { flags } = parseArgs(["-h"]);
    expect(flags.help).toBe(true);
  });

  it("collects unknown flags separately", () => {
    const { flags } = parseArgs(["analyze", "--unknown-flag", "file.json"]);
    expect(flags.unknownFlags).toContain("--unknown-flag");
  });

  it("returns empty arrays for no args", () => {
    const { flags, positional } = parseArgs([]);
    expect(positional).toHaveLength(0);
    expect(flags.json).toBe(false);
    expect(flags.help).toBe(false);
  });

  it("does not include flags in positional array", () => {
    const { positional } = parseArgs(["analyze", "--json", "file.json"]);
    expect(positional).toEqual(["analyze", "file.json"]);
  });
});

// ── buildHelpText ─────────────────────────────────────────────────────────────

describe("buildHelpText", () => {
  it("includes rag-doctor name", () => {
    expect(buildHelpText()).toContain("rag-doctor");
  });

  it("includes analyze command", () => {
    expect(buildHelpText()).toContain("analyze");
  });

  it("includes --json flag documentation", () => {
    expect(buildHelpText()).toContain("--json");
  });

  it("includes --help flag documentation", () => {
    expect(buildHelpText()).toContain("--help");
  });

  it("returns a non-empty string", () => {
    expect(buildHelpText().trim().length).toBeGreaterThan(0);
  });
});

// ── Help display ──────────────────────────────────────────────────────────────

describe("run — help display", () => {
  it("prints help when --help is passed", () => {
    const out = runCli(["--help"]);
    expect(out.stdout.join("\n")).toContain("rag-doctor");
    expect(out.exitCode).toBeNull();
  });

  it("prints help when -h is passed", () => {
    const out = runCli(["-h"]);
    expect(out.stdout.join("\n")).toContain("analyze");
  });

  it("prints help when no arguments are given", () => {
    const out = runCli([]);
    expect(out.stdout.join("\n")).toContain("rag-doctor");
    expect(out.exitCode).toBeNull();
  });
});

// ── Error paths ───────────────────────────────────────────────────────────────

describe("run — error paths", () => {
  it("exits 1 with error for unknown flag", () => {
    const out = runCli(["analyze", "trace.json", "--unknown"]);
    expect(out.exitCode).toBe(1);
    expect(out.stderr.join("\n")).toContain("--unknown");
  });

  it("exits 1 with error for unknown command", () => {
    const out = runCli(["foobar"]);
    expect(out.exitCode).toBe(1);
    expect(out.stderr.join("\n")).toContain("foobar");
  });

  it("exits 1 with error when analyze has no file argument", () => {
    const out = runCli(["analyze"]);
    expect(out.exitCode).toBe(1);
    expect(out.stderr.join("\n")).toContain("analyze");
  });

  it("exits 1 with error when file does not exist", () => {
    const out = runCli(["analyze", "/nonexistent/path/trace.json"]);
    expect(out.exitCode).toBe(1);
    expect(out.stderr.join("\n")).toContain("File not found");
  });

  it("exits 1 with human-readable error for invalid JSON file", () => {
    const out = runCli(["analyze", fixture("invalid-json.txt")]);
    expect(out.exitCode).toBe(1);
    const errOut = out.stderr.join("\n");
    expect(errOut).toContain("not valid JSON");
  });

  it("exits 1 with human-readable error for invalid schema", () => {
    const out = runCli(["analyze", fixture("invalid-schema.json")]);
    expect(out.exitCode).toBe(1);
    const errOut = out.stderr.join("\n");
    expect(errOut).toContain("Invalid trace format");
  });

  it("error messages always start with 'Error:'", () => {
    const cases = [
      ["analyze"],
      ["analyze", "/nonexistent.json"],
      ["--unknown-flag"],
    ];
    for (const argv of cases) {
      const out = runCli(argv);
      if (out.stderr.length > 0) {
        expect(out.stderr[0]).toMatch(/^Error:/);
      }
    }
  });
});

// ── Successful analyze — terminal output ──────────────────────────────────────

describe("run — analyze (terminal output)", () => {
  it("exits 0 for a clean trace with no issues", () => {
    const out = runCli(["analyze", fixture("valid-clean-trace.json")]);
    expect(out.exitCode).toBeNull(); // no exit call → healthy
    expect(out.stderr).toHaveLength(0);
  });

  it("prints RAG Doctor Report header for clean trace", () => {
    const out = runCli(["analyze", fixture("valid-clean-trace.json")]);
    expect(out.stdout.join("\n")).toContain("RAG Doctor Report");
  });

  it("prints no-issues message for clean trace", () => {
    const out = runCli(["analyze", fixture("valid-clean-trace.json")]);
    // Strip ANSI for assertion
    const plain = out.stdout.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
    expect(plain).toContain("No issues detected");
  });

  it("exits 1 for a low-score trace (high severity finding)", () => {
    const out = runCli(["analyze", fixture("broken-low-score-trace.json")]);
    expect(out.exitCode).toBe(1);
  });

  it("prints findings for low-score trace", () => {
    const out = runCli(["analyze", fixture("broken-low-score-trace.json")]);
    const plain = out.stdout.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
    expect(plain).toContain("HIGH");
  });

  it("prints findings for duplicate-chunks trace (medium severity → exit 0)", () => {
    const out = runCli(["analyze", fixture("broken-duplicate-trace.json")]);
    // medium only → no high findings → exit 0
    expect(out.exitCode).toBeNull();
    const plain = out.stdout.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
    expect(plain).toContain("MEDIUM");
  });

  it("prints findings for context-overload trace", () => {
    const out = runCli(["analyze", fixture("context-overload-trace.json")]);
    const plain = out.stdout.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
    expect(plain).toContain("MEDIUM");
  });

  it("prints findings for oversized-chunk trace", () => {
    const out = runCli(["analyze", fixture("oversized-chunk-trace.json")]);
    const plain = out.stdout.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
    expect(plain).toContain("LOW");
  });

  it("prints multiple finding types for multi-rule trace", () => {
    const out = runCli(["analyze", fixture("multi-rule-trace.json")]);
    const plain = out.stdout.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
    expect(plain).toContain("HIGH");
    expect(plain).toContain("MEDIUM");
  });
});

// ── Successful analyze — --json output ────────────────────────────────────────

describe("run — analyze --json", () => {
  it("outputs valid JSON to stdout", () => {
    const out = runCli(["analyze", fixture("valid-clean-trace.json"), "--json"]);
    expect(() => JSON.parse(out.stdout.join("\n"))).not.toThrow();
  });

  it("JSON output has findings array", () => {
    const out = runCli(["analyze", fixture("valid-clean-trace.json"), "--json"]);
    const parsed = JSON.parse(out.stdout.join("\n"));
    expect(Array.isArray(parsed.findings)).toBe(true);
  });

  it("JSON output has summary with high/medium/low", () => {
    const out = runCli(["analyze", fixture("valid-clean-trace.json"), "--json"]);
    const parsed = JSON.parse(out.stdout.join("\n"));
    expect(typeof parsed.summary.high).toBe("number");
    expect(typeof parsed.summary.medium).toBe("number");
    expect(typeof parsed.summary.low).toBe("number");
  });

  it("JSON output includes correct findings for low-score trace", () => {
    const out = runCli(["analyze", fixture("broken-low-score-trace.json"), "--json"]);
    const parsed = JSON.parse(out.stdout.join("\n"));
    expect(parsed.summary.high).toBeGreaterThan(0);
    const lowScoreFinding = parsed.findings.find(
      (f: { ruleId: string }) => f.ruleId === "low-retrieval-score",
    );
    expect(lowScoreFinding).toBeDefined();
  });

  it("JSON output for clean trace has zero findings", () => {
    const out = runCli(["analyze", fixture("valid-clean-trace.json"), "--json"]);
    const parsed = JSON.parse(out.stdout.join("\n"));
    expect(parsed.findings).toHaveLength(0);
    expect(parsed.summary).toEqual({ high: 0, medium: 0, low: 0 });
  });

  it("does not print terminal report (no ANSI) when --json is used", () => {
    const out = runCli(["analyze", fixture("broken-low-score-trace.json"), "--json"]);
    expect(out.stdout.join("")).not.toContain("RAG Doctor Report");
  });

  it("--json does not exit 1 on high severity (lets CI handle the JSON)", () => {
    // With --json the exit is not triggered by high severity — caller handles it
    const out = runCli(["analyze", fixture("broken-low-score-trace.json"), "--json"]);
    expect(out.exitCode).toBeNull();
  });
});

// ── runAnalyzeCommand direct ──────────────────────────────────────────────────

describe("runAnalyzeCommand", () => {
  it("returns the AnalysisResult for a valid trace", () => {
    const { io } = makeIO();
    const result = runAnalyzeCommand(
      fixture("valid-clean-trace.json"),
      { json: false, help: false, unknownFlags: [] },
      io,
    );
    expect(result).toHaveProperty("findings");
    expect(result).toHaveProperty("summary");
  });

  it("summary is zeroed for a clean trace", () => {
    const { io } = makeIO();
    const result = runAnalyzeCommand(
      fixture("valid-clean-trace.json"),
      { json: false, help: false, unknownFlags: [] },
      io,
    );
    expect(result.summary).toEqual({ high: 0, medium: 0, low: 0 });
  });
});

// ── run — diagnose (terminal output) ─────────────────────────────────────────

describe("run — diagnose (terminal output)", () => {
  it("prints RAG Doctor Diagnosis header for clean trace", () => {
    const out = runCli(["diagnose", fixture("valid-clean-trace.json")]);
    const plain = out.stdout.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
    expect(plain).toContain("RAG Doctor Diagnosis");
  });

  it("exits 0 for a clean trace with no issues", () => {
    const out = runCli(["diagnose", fixture("valid-clean-trace.json")]);
    expect(out.exitCode).toBeNull();
    expect(out.stderr).toHaveLength(0);
  });

  it("prints healthy message for clean trace", () => {
    const out = runCli(["diagnose", fixture("valid-clean-trace.json")]);
    const plain = out.stdout.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
    expect(plain).toContain("No root cause identified");
  });

  it("exits 1 for a low-score trace (high severity)", () => {
    const out = runCli(["diagnose", fixture("broken-low-score-trace.json")]);
    expect(out.exitCode).toBe(1);
  });

  it("prints primary cause for low-score trace", () => {
    const out = runCli(["diagnose", fixture("broken-low-score-trace.json")]);
    const plain = out.stdout.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
    expect(plain).toContain("Retrieval Quality Degradation");
  });

  it("prints recommendations for low-score trace", () => {
    const out = runCli(["diagnose", fixture("broken-low-score-trace.json")]);
    const plain = out.stdout.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
    expect(plain).toContain("Recommendations");
  });

  it("prints contributing causes for multi-rule trace", () => {
    const out = runCli(["diagnose", fixture("multi-rule-trace.json")]);
    const plain = out.stdout.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
    expect(plain).toContain("Contributing causes");
  });
});

// ── run — diagnose --json ─────────────────────────────────────────────────────

describe("run — diagnose --json", () => {
  it("outputs valid JSON to stdout", () => {
    const out = runCli(["diagnose", fixture("valid-clean-trace.json"), "--json"]);
    expect(() => JSON.parse(out.stdout.join("\n"))).not.toThrow();
  });

  it("JSON output has primaryCause field", () => {
    const out = runCli(["diagnose", fixture("valid-clean-trace.json"), "--json"]);
    const parsed = JSON.parse(out.stdout.join("\n")) as Record<string, unknown>;
    expect("primaryCause" in parsed).toBe(true);
  });

  it("JSON output has contributingCauses array", () => {
    const out = runCli(["diagnose", fixture("valid-clean-trace.json"), "--json"]);
    const parsed = JSON.parse(out.stdout.join("\n")) as Record<string, unknown>;
    expect(Array.isArray(parsed["contributingCauses"])).toBe(true);
  });

  it("JSON output has evidence array", () => {
    const out = runCli(["diagnose", fixture("valid-clean-trace.json"), "--json"]);
    const parsed = JSON.parse(out.stdout.join("\n")) as Record<string, unknown>;
    expect(Array.isArray(parsed["evidence"])).toBe(true);
  });

  it("JSON output has recommendations array", () => {
    const out = runCli(["diagnose", fixture("valid-clean-trace.json"), "--json"]);
    const parsed = JSON.parse(out.stdout.join("\n")) as Record<string, unknown>;
    expect(Array.isArray(parsed["recommendations"])).toBe(true);
  });

  it("primaryCause is null for clean trace", () => {
    const out = runCli(["diagnose", fixture("valid-clean-trace.json"), "--json"]);
    const parsed = JSON.parse(out.stdout.join("\n")) as { primaryCause: unknown };
    expect(parsed.primaryCause).toBeNull();
  });

  it("primaryCause.id is retrieval-quality-degradation for low-score trace", () => {
    const out = runCli(["diagnose", fixture("broken-low-score-trace.json"), "--json"]);
    const parsed = JSON.parse(out.stdout.join("\n")) as {
      primaryCause: { id: string };
    };
    expect(parsed.primaryCause.id).toBe("retrieval-quality-degradation");
  });

  it("does not print diagnosis report (no ANSI) when --json is used", () => {
    const out = runCli(["diagnose", fixture("broken-low-score-trace.json"), "--json"]);
    expect(out.stdout.join("")).not.toContain("RAG Doctor Diagnosis");
  });

  it("--json does not exit 1 on high severity (lets caller handle JSON)", () => {
    const out = runCli(["diagnose", fixture("broken-low-score-trace.json"), "--json"]);
    expect(out.exitCode).toBeNull();
  });
});

// ── run — diagnose error paths ────────────────────────────────────────────────

describe("run — diagnose error paths", () => {
  it("exits 1 with error when diagnose has no file argument", () => {
    const out = runCli(["diagnose"]);
    expect(out.exitCode).toBe(1);
    expect(out.stderr.join("\n")).toContain("diagnose");
  });

  it("exits 1 with error when file does not exist", () => {
    const out = runCli(["diagnose", "/nonexistent/path/trace.json"]);
    expect(out.exitCode).toBe(1);
    expect(out.stderr.join("\n")).toContain("File not found");
  });

  it("exits 1 with human-readable error for invalid JSON file", () => {
    const out = runCli(["diagnose", fixture("invalid-json.txt")]);
    expect(out.exitCode).toBe(1);
    expect(out.stderr.join("\n")).toContain("not valid JSON");
  });

  it("exits 1 with human-readable error for invalid schema", () => {
    const out = runCli(["diagnose", fixture("invalid-schema.json")]);
    expect(out.exitCode).toBe(1);
    expect(out.stderr.join("\n")).toContain("Invalid trace format");
  });
});

// ── runDiagnoseCommand direct ─────────────────────────────────────────────────

describe("runDiagnoseCommand", () => {
  it("returns a DiagnosisResult for a valid trace", () => {
    const { io } = makeIO();
    const result = runDiagnoseCommand(
      fixture("valid-clean-trace.json"),
      { json: false, help: false, unknownFlags: [] },
      io,
    );
    expect(result).toHaveProperty("primaryCause");
    expect(result).toHaveProperty("contributingCauses");
    expect(result).toHaveProperty("evidence");
    expect(result).toHaveProperty("recommendations");
  });

  it("primaryCause is null for a clean trace", () => {
    const { io } = makeIO();
    const result = runDiagnoseCommand(
      fixture("valid-clean-trace.json"),
      { json: false, help: false, unknownFlags: [] },
      io,
    );
    expect(result.primaryCause).toBeNull();
  });

  it("primaryCause is non-null for a low-score trace", () => {
    const { io } = makeIO();
    try {
      const result = runDiagnoseCommand(
        fixture("broken-low-score-trace.json"),
        { json: false, help: false, unknownFlags: [] },
        io,
      );
      expect(result.primaryCause).not.toBeNull();
    } catch (err) {
      // CliExitError is thrown on exit(1); result was already set before exit
      if (!(err instanceof CliExitError)) throw err;
    }
  });
});

// ── Phase 2B: ingestion pipeline integration ──────────────────────────────────

describe("run — analyze uses ingestion pipeline (Phase 2B)", () => {
  it("produces field-level error details for invalid schema", () => {
    const out = runCli(["analyze", fixture("invalid-schema.json")]);
    expect(out.exitCode).toBe(1);
    const errOut = out.stderr.join("\n");
    expect(errOut).toContain("Invalid trace format");
  });

  it("exits 1 for invalid-missing-fields fixture", () => {
    const out = runCli(["analyze", fixture("invalid-missing-fields.json")]);
    expect(out.exitCode).toBe(1);
    expect(out.stderr.join("\n")).toContain("Invalid trace format");
  });

  it("exits 1 for invalid-bad-score-type fixture", () => {
    const out = runCli(["analyze", fixture("invalid-bad-score-type.json")]);
    expect(out.exitCode).toBe(1);
    expect(out.stderr.join("\n")).toContain("Invalid trace format");
  });

  it("exits 1 for invalid-malformed-chunks fixture", () => {
    const out = runCli(["analyze", fixture("invalid-malformed-chunks.json")]);
    expect(out.exitCode).toBe(1);
    expect(out.stderr.join("\n")).toContain("Invalid trace format");
  });

  it("succeeds for valid-minimal-trace fixture", () => {
    const out = runCli(["analyze", fixture("valid-minimal-trace.json")]);
    expect(out.exitCode).toBeNull();
    expect(out.stderr).toHaveLength(0);
  });

  it("exits 1 for valid-low-score-trace fixture (scores below threshold)", () => {
    const out = runCli(["analyze", fixture("valid-low-score-trace.json")]);
    expect(out.exitCode).toBe(1);
    const plain = out.stdout.join("\n").replace(/\x1b\[[0-9;]*m/g, "");
    expect(plain).toContain("HIGH");
  });
});

describe("run — diagnose uses ingestion pipeline (Phase 2B)", () => {
  it("exits 1 for invalid-missing-fields fixture", () => {
    const out = runCli(["diagnose", fixture("invalid-missing-fields.json")]);
    expect(out.exitCode).toBe(1);
    expect(out.stderr.join("\n")).toContain("Invalid trace format");
  });

  it("exits 1 for invalid-bad-score-type fixture", () => {
    const out = runCli(["diagnose", fixture("invalid-bad-score-type.json")]);
    expect(out.exitCode).toBe(1);
    expect(out.stderr.join("\n")).toContain("Invalid trace format");
  });

  it("succeeds for valid-minimal-trace fixture", () => {
    const out = runCli(["diagnose", fixture("valid-minimal-trace.json")]);
    expect(out.exitCode).toBeNull();
    expect(out.stderr).toHaveLength(0);
  });
});

describe("run — --json error output mode (Phase 2B)", () => {
  it("--json mode outputs structured JSON to stderr for invalid JSON file", () => {
    const out = runCli(["analyze", fixture("invalid-json.txt"), "--json"]);
    expect(out.exitCode).toBe(1);
    const errOut = out.stderr.join("\n");
    expect(() => JSON.parse(errOut)).not.toThrow();
    const parsed = JSON.parse(errOut) as { error: string };
    expect(parsed.error).toBeDefined();
  });

  it("--json mode outputs INVALID_TRACE_SCHEMA payload to stderr for invalid schema", () => {
    const out = runCli(["analyze", fixture("invalid-schema.json"), "--json"]);
    expect(out.exitCode).toBe(1);
    const errOut = out.stderr.join("\n");
    expect(() => JSON.parse(errOut)).not.toThrow();
    const parsed = JSON.parse(errOut) as { code: string; issues: unknown[] };
    expect(parsed.code).toBe("INVALID_TRACE_SCHEMA");
    expect(Array.isArray(parsed.issues)).toBe(true);
    expect(parsed.issues.length).toBeGreaterThan(0);
  });

  it("--json mode schema error payload includes field paths", () => {
    const out = runCli(["analyze", fixture("invalid-missing-fields.json"), "--json"]);
    expect(out.exitCode).toBe(1);
    const payload = JSON.parse(out.stderr.join("\n")) as {
      issues: Array<{ path: string }>;
    };
    const paths = payload.issues.map((i) => i.path);
    expect(paths.some((p) => p === "query" || p === "retrievedChunks")).toBe(true);
  });

  it("--json mode schema error payload for bad score type includes score path", () => {
    const out = runCli(["analyze", fixture("invalid-bad-score-type.json"), "--json"]);
    expect(out.exitCode).toBe(1);
    const payload = JSON.parse(out.stderr.join("\n")) as {
      issues: Array<{ path: string; expected: string; received: string }>;
    };
    const scoreIssue = payload.issues.find((i) => i.path.includes("score"));
    expect(scoreIssue).toBeDefined();
    expect(scoreIssue?.expected).toBe("number");
    expect(scoreIssue?.received).toBe("string");
  });

  it("--json mode diagnose outputs INVALID_TRACE_SCHEMA for invalid schema", () => {
    const out = runCli(["diagnose", fixture("invalid-schema.json"), "--json"]);
    expect(out.exitCode).toBe(1);
    const payload = JSON.parse(out.stderr.join("\n")) as { code: string };
    expect(payload.code).toBe("INVALID_TRACE_SCHEMA");
  });
});
