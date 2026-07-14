import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSarif, isBaselined } from "./sarif.mjs";
import { evaluateGate, renderSummary } from "./gate.mjs";
import { readFileSync } from "node:fs";

const REAL_SARIF = JSON.parse(
  readFileSync(new URL("./__fixtures__/pmd-sample.sarif", import.meta.url), "utf8")
);

test("parses real Code Analyzer SARIF with numeric severities from rule metadata", () => {
  const findings = parseSarif(REAL_SARIF);
  assert.ok(findings.length >= 5);
  const sharing = findings.find((f) => f.rule === "ApexSharingViolations");
  assert.equal(sharing.severity, 3);
  assert.equal(sharing.engine, "pmd");
  assert.match(sharing.file, /Smelly\.cls$/);
  assert.ok(sharing.line >= 1);
});

test("gate blocks new findings at or below max severity", () => {
  const findings = [
    { rule: "A", file: "x.cls", line: 10, severity: 1, message: "critical" },
    { rule: "B", file: "x.cls", line: 20, severity: 3, message: "moderate" },
    { rule: "C", file: "x.cls", line: 30, severity: 5, message: "info" },
  ];
  const { fresh, blockers } = evaluateGate(findings, 3, []);
  assert.equal(fresh.length, 3);
  assert.deepEqual(blockers.map((b) => b.rule), ["A", "B"]);
});

test("baselined findings never block; line drift within ±5 still matches", () => {
  const baseline = [{ rule: "A", file: "x.cls", line: 12 }];
  const findings = [{ rule: "A", file: "x.cls", line: 10, severity: 1, message: "critical" }];
  assert.equal(isBaselined(findings[0], baseline), true);
  const { blockers } = evaluateGate(findings, 3, baseline);
  assert.equal(blockers.length, 0);
});

test("line drift beyond window is treated as new", () => {
  const baseline = [{ rule: "A", file: "x.cls", line: 100 }];
  const finding = { rule: "A", file: "x.cls", line: 10, severity: 2 };
  assert.equal(isBaselined(finding, baseline), false);
});

test("summary renders blocking table and clean message", () => {
  const blocked = renderSummary({
    findings: [{ rule: "A", file: "x.cls", line: 1, severity: 2, message: "bad | pipe", helpUri: "https://r" }],
    fresh: [{ rule: "A", file: "x.cls", line: 1, severity: 2, message: "bad | pipe", helpUri: "https://r" }],
    blockers: [{ rule: "A", file: "x.cls", line: 1, severity: 2, message: "bad | pipe", helpUri: "https://r" }],
    maxSeverity: 2,
  });
  assert.match(blocked, /❌ Blocking findings/);
  assert.match(blocked, /\[A\]\(https:\/\/r\)/);
  assert.match(blocked, /bad \\\| pipe/);
  assert.match(renderSummary({ findings: [], fresh: [], blockers: [], maxSeverity: 2 }), /No findings/);
});
