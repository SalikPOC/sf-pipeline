import { appendFileSync } from "node:fs";

/** Write GitHub Actions job outputs (falls back to stdout for local runs). */
export function setOutputs(pairs) {
  const lines = Object.entries(pairs).map(([k, v]) => `${k}=${String(v).replaceAll("\n", "%0A")}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, lines.join("\n") + "\n");
  } else {
    for (const line of lines) console.log(`[output] ${line}`);
  }
}
