// src/engine.ts
import { defaultRules } from "@rag-doctor/rules";
function analyzeTrace(trace, options = {}) {
  const rules = options.rules ?? defaultRules;
  const findings = [];
  for (const rule of rules) {
    const ruleFindings = rule.run(trace);
    findings.push(...ruleFindings);
  }
  const summary = computeSummary(findings);
  return { findings, summary };
}
function computeSummary(findings) {
  const tally = { high: 0, medium: 0, low: 0 };
  for (const finding of findings) {
    tally[finding.severity] += 1;
  }
  return tally;
}
export {
  analyzeTrace
};
//# sourceMappingURL=index.js.map