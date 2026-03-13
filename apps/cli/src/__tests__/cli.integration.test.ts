/**
 * Subprocess integration tests for the rag-doctor CLI binary.
 *
 * These tests spawn the compiled dist/bin.js to verify the end-to-end behavior
 * of the CLI as a real process — including exit codes, stdout/stderr content,
 * and JSON output validity.
 *
 * Prerequisites: `pnpm build` must be run before these tests.
 */
import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import { join, dirname, resolve } from "path";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BIN = join(__dirname, "../../dist/bin.js");
// apps/cli/src/__tests__ → apps/cli/src → apps/cli → apps → rag-doctor/
const REPO_ROOT = resolve(__dirname, "../../../..");
const FIXTURES = join(REPO_ROOT, "tests", "fixtures");

function fixture(name: string): string {
  return join(FIXTURES, name);
}

/** Run the CLI binary with given args, return {stdout, stderr, exitCode} */
function cli(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync("node", [BIN, ...args], {
    encoding: "utf-8",
    timeout: 15000,
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.status ?? 1,
  };
}

/** Strip ANSI escape codes */
function plain(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

// ── Guard: skip if binary not built ──────────────────────────────────────────

const binExists = existsSync(BIN);

describe.skipIf(!binExists)("CLI binary — subprocess integration", () => {
  // ── Help ────────────────────────────────────────────────────────────────────

  describe("help", () => {
    it("exits 0 and prints help with --help", () => {
      const { exitCode, stdout } = cli(["--help"]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("rag-doctor");
      expect(stdout).toContain("analyze");
    });

    it("exits 0 and prints help with -h", () => {
      const { exitCode, stdout } = cli(["-h"]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("--json");
    });

    it("exits 0 and prints help with no arguments", () => {
      const { exitCode, stdout } = cli([]);
      expect(exitCode).toBe(0);
      expect(stdout).toContain("rag-doctor");
    });
  });

  // ── Clean trace ─────────────────────────────────────────────────────────────

  describe("analyze — clean trace (no findings)", () => {
    it("exits 0 for a clean trace", () => {
      const { exitCode } = cli(["analyze", fixture("valid-clean-trace.json")]);
      expect(exitCode).toBe(0);
    });

    it("prints RAG Doctor Report to stdout", () => {
      const { stdout } = cli(["analyze", fixture("valid-clean-trace.json")]);
      expect(plain(stdout)).toContain("RAG Doctor Report");
    });

    it("prints no-issues message to stdout", () => {
      const { stdout } = cli(["analyze", fixture("valid-clean-trace.json")]);
      expect(plain(stdout)).toContain("No issues detected");
    });

    it("writes nothing to stderr on success", () => {
      const { stderr } = cli(["analyze", fixture("valid-clean-trace.json")]);
      expect(stderr.trim()).toBe("");
    });
  });

  // ── Low score trace (high severity → exit 1) ────────────────────────────────

  describe("analyze — low-score trace (high severity)", () => {
    it("exits 1 when high-severity findings are present", () => {
      const { exitCode } = cli(["analyze", fixture("broken-low-score-trace.json")]);
      expect(exitCode).toBe(1);
    });

    it("stdout contains HIGH label", () => {
      const { stdout } = cli(["analyze", fixture("broken-low-score-trace.json")]);
      expect(plain(stdout)).toContain("HIGH");
    });

    it("stderr is empty (error is a diagnostic, not a crash)", () => {
      const { stderr } = cli(["analyze", fixture("broken-low-score-trace.json")]);
      expect(stderr.trim()).toBe("");
    });
  });

  // ── Duplicate chunks trace ──────────────────────────────────────────────────

  describe("analyze — duplicate-chunks trace", () => {
    it("exits 0 (medium severity only)", () => {
      const { exitCode } = cli(["analyze", fixture("broken-duplicate-trace.json")]);
      expect(exitCode).toBe(0);
    });

    it("stdout contains MEDIUM label", () => {
      const { stdout } = cli(["analyze", fixture("broken-duplicate-trace.json")]);
      expect(plain(stdout)).toContain("MEDIUM");
    });
  });

  // ── Context overload trace ──────────────────────────────────────────────────

  describe("analyze — context-overload trace", () => {
    it("stdout contains MEDIUM label", () => {
      const { stdout } = cli(["analyze", fixture("context-overload-trace.json")]);
      expect(plain(stdout)).toContain("MEDIUM");
    });
  });

  // ── Oversized chunk trace ───────────────────────────────────────────────────

  describe("analyze — oversized-chunk trace", () => {
    it("exits 0 (low severity only)", () => {
      const { exitCode } = cli(["analyze", fixture("oversized-chunk-trace.json")]);
      expect(exitCode).toBe(0);
    });

    it("stdout contains LOW label", () => {
      const { stdout } = cli(["analyze", fixture("oversized-chunk-trace.json")]);
      expect(plain(stdout)).toContain("LOW");
    });
  });

  // ── Multi-rule trace ────────────────────────────────────────────────────────

  describe("analyze — multi-rule trace", () => {
    it("exits 1 (has high severity)", () => {
      const { exitCode } = cli(["analyze", fixture("multi-rule-trace.json")]);
      expect(exitCode).toBe(1);
    });

    it("stdout contains multiple severity labels", () => {
      const { stdout } = cli(["analyze", fixture("multi-rule-trace.json")]);
      const p = plain(stdout);
      expect(p).toContain("HIGH");
      expect(p).toContain("MEDIUM");
    });
  });

  // ── --json flag ─────────────────────────────────────────────────────────────

  describe("analyze --json", () => {
    it("stdout is valid JSON for clean trace", () => {
      const { stdout } = cli(["analyze", fixture("valid-clean-trace.json"), "--json"]);
      expect(() => JSON.parse(stdout)).not.toThrow();
    });

    it("JSON has findings and summary", () => {
      const { stdout } = cli(["analyze", fixture("valid-clean-trace.json"), "--json"]);
      const parsed = JSON.parse(stdout);
      expect(Array.isArray(parsed.findings)).toBe(true);
      expect(typeof parsed.summary).toBe("object");
    });

    it("JSON summary is zeroed for clean trace", () => {
      const { stdout } = cli(["analyze", fixture("valid-clean-trace.json"), "--json"]);
      const parsed = JSON.parse(stdout);
      expect(parsed.summary).toEqual({ high: 0, medium: 0, low: 0 });
    });

    it("JSON includes ruleId in findings for broken trace", () => {
      const { stdout } = cli(["analyze", fixture("broken-low-score-trace.json"), "--json"]);
      const parsed = JSON.parse(stdout);
      const ids = parsed.findings.map((f: { ruleId: string }) => f.ruleId);
      expect(ids).toContain("low-retrieval-score");
    });

    it("exits 0 even with high severity findings when --json used", () => {
      const { exitCode } = cli(["analyze", fixture("broken-low-score-trace.json"), "--json"]);
      expect(exitCode).toBe(0);
    });

    it("stdout is not a terminal report when --json used", () => {
      const { stdout } = cli(["analyze", fixture("broken-low-score-trace.json"), "--json"]);
      expect(plain(stdout)).not.toContain("RAG Doctor Report");
    });
  });

  // ── Error cases ─────────────────────────────────────────────────────────────

  describe("error cases", () => {
    it("exits 1 for missing analyze file argument", () => {
      const { exitCode } = cli(["analyze"]);
      expect(exitCode).toBe(1);
    });

    it("stderr contains error message for missing file argument", () => {
      const { stderr } = cli(["analyze"]);
      expect(stderr).toContain("Error:");
    });

    it("exits 1 for nonexistent file", () => {
      const { exitCode } = cli(["analyze", "/no/such/file.json"]);
      expect(exitCode).toBe(1);
    });

    it("stderr contains 'File not found' for nonexistent file", () => {
      const { stderr } = cli(["analyze", "/no/such/file.json"]);
      expect(stderr).toContain("File not found");
    });

    it("exits 1 for invalid JSON file", () => {
      const { exitCode } = cli(["analyze", fixture("invalid-json.txt")]);
      expect(exitCode).toBe(1);
    });

    it("stderr contains 'not valid JSON' for invalid JSON", () => {
      const { stderr } = cli(["analyze", fixture("invalid-json.txt")]);
      expect(stderr).toContain("not valid JSON");
    });

    it("exits 1 for invalid schema", () => {
      const { exitCode } = cli(["analyze", fixture("invalid-schema.json")]);
      expect(exitCode).toBe(1);
    });

    it("stderr contains 'Invalid trace format' for invalid schema", () => {
      const { stderr } = cli(["analyze", fixture("invalid-schema.json")]);
      expect(stderr).toContain("Invalid trace format");
    });

    it("exits 1 for unknown command", () => {
      const { exitCode } = cli(["diagnose"]);
      expect(exitCode).toBe(1);
    });

    it("stderr contains the unknown command name", () => {
      const { stderr } = cli(["diagnose"]);
      expect(stderr).toContain("diagnose");
    });

    it("exits 1 for unknown flag", () => {
      const { exitCode } = cli(["analyze", fixture("valid-clean-trace.json"), "--bad-flag"]);
      expect(exitCode).toBe(1);
    });

    it("stderr contains the unknown flag name", () => {
      const { stderr } = cli(["analyze", fixture("valid-clean-trace.json"), "--bad-flag"]);
      expect(stderr).toContain("--bad-flag");
    });
  });
});
