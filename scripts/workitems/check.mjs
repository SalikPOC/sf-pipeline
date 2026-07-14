#!/usr/bin/env node
/**
 * CI entrypoint for the work-items check.
 * Usage: check.mjs --title <t> --branch <b> [--commits-file <json array of messages>]
 * Writes job outputs: work_items (JSON array), count. Exits 1 when none found.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { extractWorkItems, NO_WORK_ITEM_MESSAGE } from "./extract.mjs";
import { setOutputs } from "../lib/output.mjs";

const args = {};
for (let i = 2; i < process.argv.length; i += 2) args[process.argv[i].replace(/^--/, "")] = process.argv[i + 1];

const commitMessages = args["commits-file"] ? JSON.parse(readFileSync(args["commits-file"], "utf8")) : [];
const items = extractWorkItems({ title: args.title, branch: args.branch, commitMessages });

setOutputs({ work_items: JSON.stringify(items), count: items.length });

if (items.length === 0) {
  console.error(NO_WORK_ITEM_MESSAGE);
  process.exit(1);
}
console.log(`Work items: ${items.map((i) => `${i.id} (${i.tracker})`).join(", ")}`);
if (args.out) writeFileSync(args.out, JSON.stringify(items, null, 2));
