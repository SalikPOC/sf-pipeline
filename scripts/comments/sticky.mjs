#!/usr/bin/env node
/**
 * Creates or updates a sticky PR comment identified by a hidden HTML marker.
 * Usage: sticky.mjs <marker> <body-file>
 * Env: GH_TOKEN, GITHUB_REPOSITORY, PR_NUMBER
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const [marker, bodyFile] = process.argv.slice(2);
const repo = process.env.GITHUB_REPOSITORY;
const pr = process.env.PR_NUMBER;
if (!marker || !bodyFile || !repo || !pr) {
  console.error("Usage: sticky.mjs <marker> <body-file>  (env: GH_TOKEN, GITHUB_REPOSITORY, PR_NUMBER)");
  process.exit(2);
}

const body = readFileSync(bodyFile, "utf8");
if (!body.includes(marker)) {
  console.error(`Body file must contain the marker ${marker}`);
  process.exit(2);
}

const gh = (args, input) =>
  execFileSync("gh", args, { encoding: "utf8", input, stdio: ["pipe", "pipe", "inherit"] });

const comments = JSON.parse(
  gh(["api", `repos/${repo}/issues/${pr}/comments`, "--paginate"])
);
const existing = comments.find((c) => c.body?.includes(marker));

const payload = JSON.stringify({ body });
if (existing) {
  gh(["api", "-X", "PATCH", `repos/${repo}/issues/comments/${existing.id}`, "--input", "-"], payload);
  console.log(`Updated sticky comment ${existing.id}`);
} else {
  gh(["api", "-X", "POST", `repos/${repo}/issues/${pr}/comments`, "--input", "-"], payload);
  console.log("Created sticky comment");
}
