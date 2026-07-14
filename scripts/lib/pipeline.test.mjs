import { test } from "node:test";
import assert from "node:assert/strict";
import { loadPipeline, resolveStage } from "./pipeline.mjs";

test("real pipeline.yml resolves all three stages", () => {
  const stages = loadPipeline(new URL("../../.orbitops/pipeline.yml", import.meta.url).pathname);
  const main = resolveStage(stages, "main");
  assert.equal(main.org, "PROD");
  assert.equal(main.authMethod, "jwt");
  assert.equal(resolveStage(stages, "integration").testLevel, "Conditional");
  assert.equal(resolveStage(stages, "uat").gates.minCoverage, 75);
});

test("unknown branch throws with known branches listed", () => {
  const stages = [{ branch: "main", org: "PROD", environment: "production", authMethod: "jwt", gates: {} }];
  assert.throws(() => resolveStage(stages, "feature/x"), /known: main/);
});

test("testLevel defaults to RunLocalTests", () => {
  const stages = [{ branch: "main", org: "PROD", environment: "production", authMethod: "jwt", gates: {} }];
  assert.equal(resolveStage(stages, "main").testLevel, "RunLocalTests");
});
