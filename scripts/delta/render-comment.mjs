#!/usr/bin/env node
/**
 * Renders the "What will deploy" sticky PR comment from an sfdx-git-delta
 * output directory (package/package.xml + destructiveChanges/destructiveChanges.xml).
 *
 * Usage: render-comment.mjs <delta-dir> [--out comment.md]
 * Job outputs: empty (true/false), component_count, destructive_count, has_apex.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { setOutputs } from "../lib/output.mjs";

export const STICKY_MARKER = "<!-- orbitops:deploy-preview -->";

/** Parse a package.xml into { [metadataType]: string[] } (no XML dep needed for this shape). */
export function parsePackageXml(xml) {
  const result = {};
  for (const typeBlock of xml.matchAll(/<types>([\s\S]*?)<\/types>/g)) {
    const name = typeBlock[1].match(/<name>(.*?)<\/name>/)?.[1];
    if (!name) continue;
    const members = [...typeBlock[1].matchAll(/<members>(.*?)<\/members>/g)].map((m) => m[1]);
    if (members.length) result[name] = (result[name] ?? []).concat(members);
  }
  return result;
}

export function renderMarkdown(changed, destructive) {
  const changedCount = Object.values(changed).reduce((n, m) => n + m.length, 0);
  const destructiveCount = Object.values(destructive).reduce((n, m) => n + m.length, 0);

  const lines = [STICKY_MARKER, "## 📦 What will deploy", ""];
  if (changedCount + destructiveCount === 0) {
    lines.push("_No deployable metadata changes in this pull request._");
    return { markdown: lines.join("\n"), changedCount, destructiveCount };
  }
  lines.push(`**${changedCount}** component${changedCount === 1 ? "" : "s"} to deploy` +
    (destructiveCount ? `, **${destructiveCount}** to delete` : "") + ":", "");
  for (const [type, members] of Object.entries(changed).sort()) {
    lines.push(`- **${type}** (${members.length})`);
    for (const m of members.sort()) lines.push(`  - ${m}`);
  }
  if (destructiveCount) {
    lines.push("", "### 🗑 Deletions");
    for (const [type, members] of Object.entries(destructive).sort()) {
      lines.push(`- **${type}** (${members.length})`);
      for (const m of members.sort()) lines.push(`  - ~~${m}~~`);
    }
  }
  return { markdown: lines.join("\n"), changedCount, destructiveCount };
}

function readPackage(dir, sub, file) {
  const p = join(dir, sub, file);
  return existsSync(p) ? parsePackageXml(readFileSync(p, "utf8")) : {};
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2];
  const outIdx = process.argv.indexOf("--out");
  const changed = readPackage(dir, "package", "package.xml");
  const destructive = readPackage(dir, "destructiveChanges", "destructiveChanges.xml");
  const { markdown, changedCount, destructiveCount } = renderMarkdown(changed, destructive);

  setOutputs({
    empty: changedCount + destructiveCount === 0,
    component_count: changedCount,
    destructive_count: destructiveCount,
    has_apex: Boolean(changed.ApexClass || changed.ApexTrigger),
  });
  if (outIdx > -1) writeFileSync(process.argv[outIdx + 1], markdown);
  else console.log(markdown);
}
