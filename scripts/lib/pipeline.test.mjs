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

test("resolveOrg finds dev orgs, stage orgs, and rejects unknown keys", async () => {
  const { loadConfig, resolveOrg } = await import("./pipeline.mjs");
  const cfg = loadConfig(new URL("../../.orbitops/pipeline.yml", import.meta.url).pathname);
  const dev = resolveOrg(cfg, "INT"); // registered dev org wins (has a friendly name)
  assert.equal(dev.authMethod, "sfdx-url");
  assert.match(dev.name, /Shared dev/);
  const prod = resolveOrg(cfg, "PROD");
  assert.equal(prod.authMethod, "jwt");
  assert.throws(() => resolveOrg(cfg, "NOPE"), /Unknown org key "NOPE"/);
});

test("resolveOrg consults the connected-orgs registry", async () => {
  const { loadConfig, resolveOrg } = await import("./pipeline.mjs");
  const cfg = loadConfig(new URL("../../.orbitops/pipeline.yml", import.meta.url).pathname);
  const reg = [{ name: "Jane's sandbox", org: "DEV_JANE", authMethod: "sfdx-url" }];
  const o = resolveOrg(cfg, "DEV_JANE", reg);
  assert.equal(o.name, "Jane's sandbox");
  assert.throws(() => resolveOrg(cfg, "DEV_JANE"), /Unknown org key/);
});
