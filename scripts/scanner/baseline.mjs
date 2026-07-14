#!/usr/bin/env node
/**
 * Generates the scanner baseline from a full-repo SARIF scan.
 * Existing violations land in .orbitops/scanner-baseline.json so only NEW
 * findings block PRs; the weekly full scan tracks the burn-down.
 * Usage: baseline.mjs <results.sarif> [--out .orbitops/scanner-baseline.json]
 */
import { writeFileSync, existsSync } from "node:fs";
import { loadSarifFile } from "./sarif.mjs";

const [sarifPath] = process.argv.slice(2);
const outIdx = process.argv.indexOf("--out");
const out = outIdx > -1 ? process.argv[outIdx + 1] : ".orbitops/scanner-baseline.json";

const findings = existsSync(sarifPath) ? loadSarifFile(sarifPath) : [];
const baseline = findings.map(({ rule, file, line, severity }) => ({ rule, file, line, severity }));
writeFileSync(out, JSON.stringify(baseline, null, 2) + "\n");
console.log(`Baseline written: ${out} (${baseline.length} finding(s))`);
