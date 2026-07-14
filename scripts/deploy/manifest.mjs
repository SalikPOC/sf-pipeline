#!/usr/bin/env node
/**
 * Builds the deployment manifest JSON recorded per deploy (REQUIREMENTS.md E4.3).
 * Usage: manifest.mjs --env <env> --seq <n> --sha <sha> --delta-dir <dir>
 *   --run-url <url> --actor <login> --timestamp <iso> [--type deploy|rollback]
 *   [--commits-file messages.json] [--extra '<json>'] --out <file>
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { parsePackageXml } from "../delta/render-comment.mjs";
import { extractIdsFromText } from "../workitems/extract.mjs";

export function buildManifest(opts) {
  const {
    env, seq, sha, runUrl, actor, timestamp,
    type = "deploy", changed = {}, destructive = {}, commitMessages = [], extra = {},
  } = opts;
  const workItems = [...new Set(commitMessages.flatMap((m) => extractIdsFromText(m)))];
  return {
    type,
    env,
    seq: Number(seq),
    sha,
    workItems,
    components: changed,
    destructive,
    componentCount: Object.values(changed).reduce((n, m) => n + m.length, 0),
    destructiveCount: Object.values(destructive).reduce((n, m) => n + m.length, 0),
    runUrl,
    actor,
    timestamp,
    ...extra,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv;
  const flag = (name, dflt = null) => {
    const i = argv.indexOf(`--${name}`);
    return i > -1 ? argv[i + 1] : dflt;
  };
  const readPkg = (dir, sub, file) => {
    const p = join(dir, sub, file);
    return existsSync(p) ? parsePackageXml(readFileSync(p, "utf8")) : {};
  };
  const deltaDir = flag("delta-dir");
  const manifest = buildManifest({
    env: flag("env"),
    seq: flag("seq"),
    sha: flag("sha"),
    runUrl: flag("run-url"),
    actor: flag("actor"),
    timestamp: flag("timestamp"),
    type: flag("type", "deploy"),
    changed: deltaDir ? readPkg(deltaDir, "package", "package.xml") : {},
    destructive: deltaDir ? readPkg(deltaDir, "destructiveChanges", "destructiveChanges.xml") : {},
    commitMessages: flag("commits-file") ? JSON.parse(readFileSync(flag("commits-file"), "utf8")) : [],
    extra: flag("extra") ? JSON.parse(flag("extra")) : {},
  });
  const out = flag("out");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(manifest, null, 2) + "\n");
  console.log(`Manifest written: ${out} (${manifest.componentCount} components, work items: ${manifest.workItems.join(", ") || "none"})`);
}
