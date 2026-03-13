// src/heuristics.ts
var HEURISTICS = [
  {
    ruleId: "low-retrieval-score",
    causeId: "retrieval-quality-degradation",
    causeTitle: "Retrieval Quality Degradation",
    confidence: "high",
    summary: "The trace shows weak retrieval relevance signals, suggesting the retriever returned low-value context for the query.",
    recommendations: [
      "Check embedding model quality and ensure it is aligned with your domain",
      "Verify retriever relevance by inspecting returned chunk content",
      "Increase topK carefully and monitor for context overload",
      "Consider adding a reranker to promote the most relevant results"
    ]
  },
  {
    ruleId: "duplicate-chunks",
    causeId: "duplicate-context-pollution",
    causeTitle: "Duplicate Context Pollution",
    confidence: "medium",
    summary: "Near-duplicate chunks were retrieved, introducing repeated context that dilutes signal quality.",
    recommendations: [
      "Deduplicate chunks before prompt assembly using MMR or cosine similarity filtering",
      "Revisit chunking overlap strategy to avoid near-identical segments",
      "Reduce repeated retrieval from the same source document"
    ]
  },
  {
    ruleId: "oversized-chunk",
    causeId: "oversized-chunking-strategy",
    causeTitle: "Oversized Chunking Strategy",
    confidence: "low",
    summary: "One or more retrieved chunks exceed the recommended size, which can dilute relevance and inflate token usage.",
    recommendations: [
      "Reduce chunk size to 200\u2013500 tokens using a recursive or semantic splitter",
      "Split documents more aggressively while preserving semantic boundaries",
      "Preserve semantic boundaries while shrinking chunks to improve precision"
    ]
  },
  {
    ruleId: "context-overload",
    causeId: "excessive-context-volume",
    causeTitle: "Excessive Context Volume",
    confidence: "medium",
    summary: "Too many chunks were included in the context window, increasing noise and reducing answer quality.",
    recommendations: [
      "Reduce topK to limit the number of retrieved chunks",
      "Add a reranker step to filter out low-signal chunks before prompt assembly",
      "Trim low-signal chunks before assembling the final prompt"
    ]
  }
];
var SEVERITY_WEIGHT = {
  high: 3,
  medium: 2,
  low: 1
};
var CONFIDENCE_WEIGHT = {
  high: 3,
  medium: 2,
  low: 1
};
function findHeuristic(ruleId) {
  return HEURISTICS.find((h) => h.ruleId === ruleId);
}
function scoreCause(entry, triggeringFindings) {
  const maxFindingSeverity = triggeringFindings.reduce(
    (max, f) => Math.max(max, SEVERITY_WEIGHT[f.severity]),
    0
  );
  return maxFindingSeverity * 10 + CONFIDENCE_WEIGHT[entry.confidence];
}
function buildRootCause(entry) {
  return {
    id: entry.causeId,
    title: entry.causeTitle,
    confidence: entry.confidence,
    summary: entry.summary
  };
}

// src/root-cause-analyzer.ts
function diagnoseTrace(analysisResult) {
  const { findings } = analysisResult;
  if (findings.length === 0) {
    return {
      primaryCause: null,
      contributingCauses: [],
      evidence: [],
      recommendations: []
    };
  }
  const evidence = findings.map((f) => ({
    findingRuleId: f.ruleId,
    findingMessage: f.message,
    severity: f.severity
  }));
  const causeMap = /* @__PURE__ */ new Map();
  for (const finding of findings) {
    const entry = findHeuristic(finding.ruleId);
    if (!entry) continue;
    const existing = causeMap.get(entry.causeId);
    if (existing) {
      existing.triggeringFindings.push(finding);
    } else {
      causeMap.set(entry.causeId, {
        entry,
        triggeringFindings: [finding]
      });
    }
  }
  if (causeMap.size === 0) {
    return {
      primaryCause: null,
      contributingCauses: [],
      evidence,
      recommendations: []
    };
  }
  const candidates = [...causeMap.values()].sort(
    (a, b) => scoreCause(b.entry, b.triggeringFindings) - scoreCause(a.entry, a.triggeringFindings)
  );
  const primaryCandidate = candidates[0];
  const rest = candidates.slice(1);
  const primaryCause = buildRootCause(primaryCandidate.entry);
  const contributingCauses = rest.map((c) => buildRootCause(c.entry));
  const seen = /* @__PURE__ */ new Set();
  const recommendations = [];
  for (const candidate of candidates) {
    for (const rec of candidate.entry.recommendations) {
      if (!seen.has(rec)) {
        seen.add(rec);
        recommendations.push(rec);
      }
    }
  }
  return {
    primaryCause,
    contributingCauses,
    evidence,
    recommendations
  };
}
export {
  diagnoseTrace
};
//# sourceMappingURL=index.js.map