#!/usr/bin/env node
/**
 * Resolves an org key (dev org or pipeline stage org) to job outputs.
 * Usage: node scripts/context/resolve-org.mjs <ORG_KEY>
 */
import { loadConfig, resolveOrg } from "../lib/pipeline.mjs";
import { setOutputs } from "../lib/output.mjs";

const key = process.argv[2];
if (!key) {
  console.error("Usage: resolve-org.mjs <ORG_KEY>");
  process.exit(2);
}

let org;
try {
  org = resolveOrg(loadConfig(), key);
} catch (err) {
  console.error(`✖ ${err.message}`);
  process.exit(1);
}

setOutputs({ org: org.org, auth_method: org.authMethod, display_name: org.name });
console.log(`Org "${key}": ${org.name} (auth=${org.authMethod})`);
