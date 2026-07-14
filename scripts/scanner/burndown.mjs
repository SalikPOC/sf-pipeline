#!/usr/bin/env node
/**
 * Weekly scanner burn-down: renders a report from a full-repo SARIF scan and
 * creates/updates the "Scanner burn-down" tracking issue.
 * Usage: burndown.mjs <results.sarif> [--issue]
 * Env (for --issue): GH_TOKEN, GITHUB_REPOSITORY
 */
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { loadSarifFile } from "./sarif.mjs";

const ISSUE_TITLE = "Scanner burn-down";

export function renderBurndown(findings) {
  const lines = [`# ${ISSUE_TITLE}`, "", `_Updated automatically by the weekly full scan._`, ""];
  if (!findings.length) {
    lines.push("🎉 No findings in the full scan.");
    return lines.join("\n");
  }
  const bySeverity = new Map();
  const byRule = new Map();
  for (const f of findings) {
    bySeverity.set(f.severity, (bySeverity.get(f.severity) ?? 0) + 1);
    byRule.set(f.rule, (byRule.get(f.rule) ?? 0) + 1);
  }
  lines.push(`**${findings.length}** total finding(s).`, "", "| Severity | Count |", "|---|---|");
  for (const sev of [...bySeverity.keys()].sort()) lines.push(`| ${sev} | ${bySeverity.get(sev)} |`);
  lines.push("", "## Top rules", "", "| Rule | Count |", "|---|---|");
  for (const [rule, count] of [...byRule.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
    lines.push(`| ${rule} | ${count} |`);
  }
  lines.push("", "Refresh the baseline after fixing findings: `npm run scan:baseline`.");
  return lines.join("\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const sarifPath = process.argv[2];
  const findings = existsSync(sarifPath) ? loadSarifFile(sarifPath) : [];
  const body = renderBurndown(findings);
  console.log(body);

  if (process.argv.includes("--issue")) {
    const repo = process.env.GITHUB_REPOSITORY;
    const gh = (args, input) =>
      execFileSync("gh", args, { encoding: "utf8", input, stdio: ["pipe", "pipe", "inherit"] });
    const existing = JSON.parse(
      gh(["issue", "list", "--repo", repo, "--search", `in:title "${ISSUE_TITLE}"`, "--state", "all", "--json", "number,title"])
    ).find((i) => i.title === ISSUE_TITLE);
    if (existing) {
      gh(["issue", "edit", String(existing.number), "--repo", repo, "--body-file", "-"], body);
      if (findings.length) gh(["issue", "reopen", String(existing.number), "--repo", repo]);
      console.log(`\nUpdated issue #${existing.number}`);
    } else {
      gh(["issue", "create", "--repo", repo, "--title", ISSUE_TITLE, "--body-file", "-"], body);
      console.log("\nCreated burn-down issue");
    }
  }
}
