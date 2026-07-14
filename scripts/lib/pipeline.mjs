import { readFileSync } from "node:fs";
import yaml from "js-yaml";

export function loadPipeline(path = ".orbitops/pipeline.yml") {
  const cfg = yaml.load(readFileSync(path, "utf8"));
  if (!cfg || !Array.isArray(cfg.pipeline)) {
    throw new Error(`${path} has no "pipeline" array — run npm run config:validate`);
  }
  return cfg.pipeline;
}

export function resolveStage(stages, branch) {
  const stage = stages.find((s) => s.branch === branch);
  if (!stage) {
    const known = stages.map((s) => s.branch).join(", ");
    throw new Error(`No pipeline stage maps to branch "${branch}" (known: ${known})`);
  }
  return { testLevel: "RunLocalTests", ...stage };
}
