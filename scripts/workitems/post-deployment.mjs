#!/usr/bin/env node
/**
 * Posts deployment status to every work item in a deploy manifest via the
 * adapter (PoC: StubAdapter records to workitem-postbacks.json for the
 * summary artifact; real tracker calls are post-PoC).
 * Usage: post-deployment.mjs <manifest.json> --status deployed|failed|rolled-back [--out workitem-postbacks.json]
 * Degrades gracefully: never exits non-zero (tracker issues must not fail deploys).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { StubAdapter, adapterFor } from "./adapter.mjs";

try {
  const manifest = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const statusIdx = process.argv.indexOf("--status");
  const status = statusIdx > -1 ? process.argv[statusIdx + 1] : "deployed";
  const outIdx = process.argv.indexOf("--out");

  const stub = new StubAdapter();
  const info = {
    env: manifest.env,
    seq: manifest.seq,
    status,
    runUrl: manifest.runUrl,
    actor: manifest.actor,
    timestamp: manifest.timestamp,
  };
  for (const id of manifest.workItems ?? []) {
    await adapterFor(id, stub).postDeploymentStatus(id, info);
  }
  if (outIdx > -1) writeFileSync(process.argv[outIdx + 1], JSON.stringify(stub.recorded, null, 2));
  console.log(`Posted "${status}" to ${manifest.workItems?.length ?? 0} work item(s)`);
} catch (err) {
  console.log(`Work-item postback skipped: ${err.message}`);
}
