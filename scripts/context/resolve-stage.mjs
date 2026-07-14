#!/usr/bin/env node
/**
 * Resolves the pipeline stage for a target branch and exposes it as job outputs.
 * Usage: node scripts/context/resolve-stage.mjs <base-branch>
 */
import { loadPipeline, resolveStage } from "../lib/pipeline.mjs";
import { setOutputs } from "../lib/output.mjs";

const branch = process.argv[2];
if (!branch) {
  console.error("Usage: resolve-stage.mjs <base-branch>");
  process.exit(2);
}

let stage;
try {
  stage = resolveStage(loadPipeline(), branch);
} catch (err) {
  console.error(`✖ ${err.message}`);
  process.exit(1);
}

setOutputs({
  org: stage.org,
  environment: stage.environment,
  auth_method: stage.authMethod,
  test_level: stage.testLevel,
  min_coverage: stage.gates.minCoverage,
  scanner_max_severity: stage.gates.scannerMaxSeverity,
});
console.log(`Stage for "${branch}": org=${stage.org} environment=${stage.environment} auth=${stage.authMethod} tests=${stage.testLevel}`);
