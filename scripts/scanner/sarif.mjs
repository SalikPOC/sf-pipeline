/**
 * SARIF parsing for Salesforce Code Analyzer v5 output.
 * Numeric severity (1=critical … 5=info) lives on the rule metadata:
 * runs[].tool.driver.rules[].properties.severity.
 */
import { readFileSync } from "node:fs";

const LEVEL_FALLBACK = { error: 2, warning: 3, note: 5, none: 5 };

/** @returns {{rule, engine, file, line, message, severity, helpUri}[]} */
export function parseSarif(sarif) {
  const findings = [];
  for (const run of sarif.runs ?? []) {
    const engine = run.tool?.driver?.name ?? "unknown";
    const rules = run.tool?.driver?.rules ?? [];
    for (const r of run.results ?? []) {
      const ruleMeta =
        (r.ruleIndex !== undefined ? rules[r.ruleIndex] : undefined) ??
        rules.find((x) => x.id === r.ruleId);
      const loc = r.locations?.[0]?.physicalLocation;
      findings.push({
        rule: r.ruleId,
        engine,
        file: loc?.artifactLocation?.uri ?? "(unknown)",
        line: loc?.region?.startLine ?? 0,
        message: r.message?.text ?? "",
        severity: ruleMeta?.properties?.severity ?? LEVEL_FALLBACK[r.level] ?? 5,
        helpUri: ruleMeta?.helpUri ?? null,
      });
    }
  }
  return findings;
}

export function loadSarifFile(path) {
  return parseSarif(JSON.parse(readFileSync(path, "utf8")));
}

/** Baseline entry identity: same rule + file, line within ±5 (code drifts). */
export function isBaselined(finding, baseline, lineWindow = 5) {
  return baseline.some(
    (b) => b.rule === finding.rule && b.file === finding.file && Math.abs(b.line - finding.line) <= lineWindow
  );
}
