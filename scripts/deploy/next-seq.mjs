/**
 * Deploy sequence numbers from `deploy/<env>/<seq>` tags.
 */
export function parseSeq(tag, env) {
  const m = tag.match(new RegExp(`^deploy/${env}/(\\d+)$`));
  return m ? Number(m[1]) : null;
}

/** @param {string[]} tags all tags (any env) @returns {number} highest seq for env, 0 if none */
export function latestSeq(tags, env) {
  return tags.reduce((max, t) => {
    const n = parseSeq(t, env);
    return n !== null && n > max ? n : max;
  }, 0);
}

export function nextSeq(tags, env) {
  return latestSeq(tags, env) + 1;
}

export function latestTag(tags, env) {
  const seq = latestSeq(tags, env);
  return seq === 0 ? null : `deploy/${env}/${seq}`;
}

// CLI: `git tag -l 'deploy/<env>/*' | node next-seq.mjs <env> [--latest]`
// Prints the next sequence number, or with --latest the latest tag ("" if none).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const { readFileSync } = await import("node:fs");
  const env = process.argv[2];
  const tags = readFileSync(0, "utf8").split("\n").filter(Boolean);
  console.log(process.argv.includes("--latest") ? (latestTag(tags, env) ?? "") : nextSeq(tags, env));
}
