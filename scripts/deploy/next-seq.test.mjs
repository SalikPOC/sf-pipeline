import { test } from "node:test";
import assert from "node:assert/strict";
import { nextSeq, latestSeq, latestTag } from "./next-seq.mjs";

test("no prior tags → seq 1, no latest tag", () => {
  assert.equal(nextSeq([], "integration"), 1);
  assert.equal(latestTag([], "integration"), null);
});

test("gaps and other envs are handled", () => {
  const tags = ["deploy/integration/1", "deploy/integration/5", "deploy/uat/9", "v1.0", "deploy/integration/notanum"];
  assert.equal(latestSeq(tags, "integration"), 5);
  assert.equal(nextSeq(tags, "integration"), 6);
  assert.equal(latestTag(tags, "integration"), "deploy/integration/5");
  assert.equal(nextSeq(tags, "production"), 1);
});

test("env names with regex-safe handling", () => {
  assert.equal(nextSeq(["deploy/uat/2"], "uat"), 3);
});
