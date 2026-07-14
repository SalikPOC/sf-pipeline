#!/usr/bin/env node
/**
 * Coverage gate: compares coverage.json (from parse-validate-result.mjs)
 * against a stage's minCoverage.
 * Usage: check-coverage.mjs <coverage.json> <minCoverage> [--summary summary.md]
 * Exits 1 when below threshold.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [file, minRaw] = process.argv.slice(2);
const min = Number(minRaw);
const { overall, perClass } = JSON.parse(readFileSync(file, "utf8"));

const lines = ["## 🧪 Coverage gate", ""];
let ok = true;

if (min === 0) {
  lines.push(`No minimum coverage required for this stage — gate passes.`);
} else if (overall === null) {
  lines.push(`No Apex tests ran, but this stage requires ≥ ${min}% coverage.`);
  ok = false;
} else {
  const mark = overall >= min ? "✅" : "❌";
  lines.push(`${mark} Overall coverage **${overall}%** (required: ${min}%)`);
  ok = overall >= min;
  const weak = perClass.filter((c) => c.percent < min);
  if (weak.length) {
    lines.push("", "| Class | Coverage |", "|---|---|");
    for (const c of weak) lines.push(`| ${c.name} | ${c.percent}% |`);
  }
}

const summaryIdx = process.argv.indexOf("--summary");
if (summaryIdx > -1) writeFileSync(process.argv[summaryIdx + 1], lines.join("\n"));
console.log(lines.join("\n"));
process.exit(ok ? 0 : 1);
