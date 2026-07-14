import { test } from "node:test";
import assert from "node:assert/strict";
import { buildManifest } from "./manifest.mjs";

test("manifest aggregates components, work items from full messages, counts", () => {
  const m = buildManifest({
    env: "integration",
    seq: "3",
    sha: "abc123",
    runUrl: "https://run",
    actor: "SalikPOC",
    timestamp: "2026-07-14T00:00:00Z",
    changed: { CustomField: ["BUP_Clinic__c.Notes__c"], ApexClass: ["A", "B"] },
    destructive: { CustomField: ["Old__c.X__c"] },
    commitMessages: ["Merge pull request #1 (POC-1)\n\nAdd Notes field", "chore\n\nWork-Items: AB#9"],
  });
  assert.equal(m.seq, 3);
  assert.equal(m.componentCount, 3);
  assert.equal(m.destructiveCount, 1);
  assert.deepEqual(m.workItems, ["POC-1", "AB#9"]);
  assert.equal(m.type, "deploy");
});

test("rollback type and extra fields pass through", () => {
  const m = buildManifest({
    env: "uat", seq: 4, sha: "x", runUrl: "u", actor: "a", timestamp: "t",
    type: "rollback", extra: { rolledBackFrom: 4, rolledBackTo: 2, reason: "bad release" },
  });
  assert.equal(m.type, "rollback");
  assert.equal(m.rolledBackTo, 2);
  assert.equal(m.componentCount, 0);
});
