// src/ansi.ts
var ANSI = {
  reset: "\x1B[0m",
  bold: "\x1B[1m",
  dim: "\x1B[2m",
  red: "\x1B[31m",
  yellow: "\x1B[33m",
  green: "\x1B[32m",
  blue: "\x1B[34m",
  cyan: "\x1B[36m",
  white: "\x1B[37m",
  gray: "\x1B[90m",
  bgRed: "\x1B[41m",
  bgYellow: "\x1B[43m",
  bgGreen: "\x1B[42m"
};
function bold(s) {
  return `${ANSI.bold}${s}${ANSI.reset}`;
}
function dim(s) {
  return `${ANSI.dim}${s}${ANSI.reset}`;
}
function red(s) {
  return `${ANSI.red}${s}${ANSI.reset}`;
}
function yellow(s) {
  return `${ANSI.yellow}${s}${ANSI.reset}`;
}
function green(s) {
  return `${ANSI.green}${s}${ANSI.reset}`;
}
function cyan(s) {
  return `${ANSI.cyan}${s}${ANSI.reset}`;
}

// src/terminal.reporter.ts
var SEVERITY_LABELS = {
  high: "HIGH",
  medium: "MEDIUM",
  low: "LOW"
};
function colorSeverity(severity) {
  switch (severity) {
    case "high":
      return red(`[${SEVERITY_LABELS.high}]`);
    case "medium":
      return yellow(`[${SEVERITY_LABELS.medium}]`);
    case "low":
      return green(`[${SEVERITY_LABELS.low}]`);
  }
}
function formatFinding(finding) {
  const lines = [];
  lines.push(`${colorSeverity(finding.severity)} ${bold(finding.message)}`);
  if (finding.recommendation) {
    lines.push(`  ${dim("\u2192")} ${finding.recommendation}`);
  }
  return lines.join("\n");
}
function formatSummary(result) {
  const { high, medium, low } = result.summary;
  const total = high + medium + low;
  const lines = [
    bold(cyan("  RAG Doctor Report  ")),
    "\u2500".repeat(50),
    "",
    `  ${bold("Total findings:")}  ${total}`,
    `  ${red("High")}:            ${high}`,
    `  ${yellow("Medium")}:          ${medium}`,
    `  ${green("Low")}:             ${low}`,
    "",
    "\u2500".repeat(50)
  ];
  return lines.join("\n");
}
function printTerminalReport(result, options = {}) {
  const write = options.write ?? ((line) => process.stdout.write(line + "\n"));
  write("");
  write(formatSummary(result));
  write("");
  if (result.findings.length === 0) {
    write(green("  \u2713 No issues detected. Your RAG pipeline looks healthy!"));
    write("");
    return;
  }
  write(bold("  Findings:"));
  write("");
  const sorted = [...result.findings].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });
  for (const finding of sorted) {
    write("  " + formatFinding(finding).replace(/\n/g, "\n  "));
    write("");
  }
}

// src/diagnosis.reporter.ts
function colorConfidence(confidence) {
  switch (confidence) {
    case "high":
      return red("[HIGH CONFIDENCE]");
    case "medium":
      return yellow("[MEDIUM CONFIDENCE]");
    case "low":
      return green("[LOW CONFIDENCE]");
  }
}
function formatCause(cause, label, write) {
  write(`${bold(label)}`);
  write(`  ${colorConfidence(cause.confidence)} ${bold(cause.title)}`);
  write("");
  write(`  ${cause.summary}`);
  write("");
}
function printDiagnosisReport(result, options = {}) {
  const write = options.write ?? ((line) => process.stdout.write(line + "\n"));
  write("");
  write(bold(cyan("  RAG Doctor Diagnosis  ")));
  write("\u2500".repeat(50));
  write("");
  if (!result.primaryCause) {
    write(green("  \u2713 No root cause identified. Your RAG pipeline looks healthy!"));
    write("");
    return;
  }
  formatCause(result.primaryCause, "Primary root cause:", write);
  if (result.contributingCauses.length > 0) {
    write(bold("Contributing causes:"));
    write("");
    for (const cause of result.contributingCauses) {
      write(`  ${colorConfidence(cause.confidence)} ${bold(cause.title)}`);
      write(`  ${dim("\u2192")} ${cause.summary}`);
      write("");
    }
  }
  if (result.evidence.length > 0) {
    write("\u2500".repeat(50));
    write("");
    write(bold("Evidence:"));
    write("");
    for (const ev of result.evidence) {
      const severityLabel = ev.severity === "high" ? red("[HIGH]") : ev.severity === "medium" ? yellow("[MEDIUM]") : green("[LOW]");
      write(`  ${severityLabel} ${ev.findingMessage}`);
    }
    write("");
  }
  if (result.recommendations.length > 0) {
    write("\u2500".repeat(50));
    write("");
    write(bold("Recommendations:"));
    write("");
    for (const rec of result.recommendations) {
      write(`  ${dim("\u2192")} ${rec}`);
    }
    write("");
  }
}
export {
  printDiagnosisReport,
  printTerminalReport
};
//# sourceMappingURL=index.js.map