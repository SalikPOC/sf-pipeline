#!/usr/bin/env node
/**
 * Scanner severity gate.
 * Usage: gate.mjs <results.sarif> <maxSeverity> [--baseline baseline.json] [--out summary.md]
 * A NEW finding (not in baseline) with severity <= maxSeverity (1 = most severe)
 * blocks. Exit 1 when blocked. Job outputs: total, new, blockers.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { loadSarifFile, isBaselined } from "./sarif.mjs";
import { setOutputs } from "../lib/output.mjs";

export function evaluateGate(findings, maxSeverity, baseline) {
  const fresh = findings.filter((f) => !isBaselined(f, baseline));
  const blockers = fresh.filter((f) => f.severity <= maxSeverity);
  return { fresh, blockers };
}

export function renderSummary({ findings, fresh, blockers, maxSeverity }) {
  const lines = ["## 🔍 Code scan", ""];
  if (findings.length === 0) {
    lines.push("No findings in the changed files. ✅");
    return lines.join("\n");
  }
  lines.push(
    `${findings.length} finding(s) in changed files — ${fresh.length} new (not in baseline), ` +
      `**${blockers.length} blocking** (severity ≤ ${maxSeverity}).`,
    ""
  );
  const show = (list, title) => {
    if (!list.length) return;
    lines.push(`### ${title}`, "", "| Sev | Rule | File:Line | Message |", "|---|---|---|---|");
    for (const f of list.slice(0, 25)) {
      const rule = f.helpUri ? `[${f.rule}](${f.helpUri})` : f.rule;
      lines.push(`| ${f.severity} | ${rule} | \`${f.file}:${f.line}\` | ${f.message.replaceAll("|", "\\|")} |`);
    }
    if (list.length > 25) lines.push("", `…and ${list.length - 25} more (see the SARIF artifact).`);
  };
  show(blockers, "❌ Blocking findings");
  show(
    fresh.filter((f) => !blockers.includes(f)),
    "New non-blocking findings"
  );
  return lines.join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [sarifPath, maxRaw] = process.argv.slice(2);
  const maxSeverity = Number(maxRaw);
  const baselineIdx = process.argv.indexOf("--baseline");
  const baseline =
    baselineIdx > -1 && existsSync(process.argv[baselineIdx + 1])
      ? JSON.parse(readFileSync(process.argv[baselineIdx + 1], "utf8"))
      : [];

  const findings = existsSync(sarifPath) ? loadSarifFile(sarifPath) : [];
  const { fresh, blockers } = evaluateGate(findings, maxSeverity, baseline);
  const summary = renderSummary({ findings, fresh, blockers, maxSeverity });

  const outIdx = process.argv.indexOf("--out");
  if (outIdx > -1) writeFileSync(process.argv[outIdx + 1], summary);
  console.log(summary);

  setOutputs({ total: findings.length, new: fresh.length, blockers: blockers.length });
  process.exit(blockers.length ? 1 : 0);
}
