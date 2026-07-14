import { test } from "node:test";
import assert from "node:assert/strict";
import { extractWorkItems, extractIdsFromText } from "./extract.mjs";

test("extracts Jira key from branch name", () => {
  const items = extractWorkItems({ branch: "feature/PROJ-123-discount-field" });
  assert.deepEqual(items, [{ id: "PROJ-123", tracker: "jira" }]);
});

test("extracts ADO ref from PR title", () => {
  const items = extractWorkItems({ title: "Add case routing AB#456" });
  assert.deepEqual(items, [{ id: "AB#456", tracker: "ado" }]);
});

test("extracts mixed IDs from commit footers only", () => {
  const items = extractWorkItems({
    commitMessages: [
      "feat: add field\n\nWork-Items: PROJ-9, AB#77",
      "chore: PROJ-999 mentioned in body but no footer",
    ],
  });
  assert.deepEqual(items.map((i) => i.id), ["PROJ-9", "AB#77"]);
});

test("dedupes across sources, keeps discovery order", () => {
  const items = extractWorkItems({
    title: "PROJ-1 and AB#2",
    branch: "feature/PROJ-1-x",
    commitMessages: ["msg\n\nWork-Items: AB#2, PROJ-3"],
  });
  assert.deepEqual(items.map((i) => i.id), ["PROJ-1", "AB#2", "PROJ-3"]);
});

test("rejects malformed near-misses", () => {
  assert.deepEqual(extractIdsFromText("PROJ123 ab#4 P-1 -22"), []);
});

test("empty sources produce empty result", () => {
  assert.deepEqual(extractWorkItems({}), []);
});
