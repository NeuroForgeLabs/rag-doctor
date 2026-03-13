// src/engine.ts
import { defaultRules, BUILT_IN_PACKS } from "@rag-doctor/rules";
function resolveRules(options) {
  if (options.rules !== void 0) {
    return options.rules;
  }
  if (options.packs !== void 0 && options.packs.length > 0) {
    const resolved = [];
    for (const packName of options.packs) {
      const pack = BUILT_IN_PACKS[packName];
      if (!pack) {
        throw new UnknownPackError(packName);
      }
      resolved.push(...pack.resolve(options.ruleOptions));
    }
    return resolved;
  }
  return defaultRules;
}
var UnknownPackError = class extends Error {
  code = "UNKNOWN_PACK_ERROR";
  packName;
  constructor(packName) {
    const available = Object.keys(BUILT_IN_PACKS).join(", ");
    super(
      `Unknown rule pack "${packName}". Available built-in packs: ${available}`
    );
    this.name = "UnknownPackError";
    this.packName = packName;
  }
};
function analyzeTrace(trace, options = {}) {
  const rules = resolveRules(options);
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

// src/index.ts
import { RuleConfigurationError } from "@rag-doctor/rules";
export {
  RuleConfigurationError,
  UnknownPackError,
  analyzeTrace,
  resolveRules
};
//# sourceMappingURL=index.js.map