#!/usr/bin/env node
/**
 * Merges a JSON fragment into orbitops-summary.json under a named key.
 * Usage: append.mjs <key> <fragment.json|inline-json> [--file orbitops-summary.json]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const [key, fragmentArg] = process.argv.slice(2);
const fileIdx = process.argv.indexOf("--file");
const file = fileIdx > -1 ? process.argv[fileIdx + 1] : "orbitops-summary.json";

const fragment = existsSync(fragmentArg)
  ? JSON.parse(readFileSync(fragmentArg, "utf8"))
  : JSON.parse(fragmentArg);

const summary = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
summary[key] = fragment;
writeFileSync(file, JSON.stringify(summary, null, 2));
console.log(`summary: recorded "${key}"`);
