import { readFileSync } from "node:fs";
import yaml from "js-yaml";

export function loadConfig(path = ".orbitops/pipeline.yml") {
  const cfg = yaml.load(readFileSync(path, "utf8"));
  if (!cfg || !Array.isArray(cfg.pipeline)) {
    throw new Error(`${path} has no "pipeline" array — run npm run config:validate`);
  }
  return { pipeline: cfg.pipeline, devOrgs: cfg.devOrgs ?? [] };
}

export function loadPipeline(path = ".orbitops/pipeline.yml") {
  return loadConfig(path).pipeline;
}

/** Resolve any org key (dev org or stage org) to its auth method + display name. */
export function resolveOrg(config, orgKey) {
  const dev = config.devOrgs.find((d) => d.org === orgKey);
  if (dev) return { org: dev.org, authMethod: dev.authMethod, name: dev.name };
  const stage = config.pipeline.find((s) => s.org === orgKey);
  if (stage) return { org: stage.org, authMethod: stage.authMethod, name: `${stage.environment} org` };
  const known = [
    ...config.devOrgs.map((d) => d.org),
    ...config.pipeline.map((s) => s.org),
  ].join(", ");
  throw new Error(`Unknown org key "${orgKey}" (known: ${known})`);
}

export function resolveStage(stages, branch) {
  const stage = stages.find((s) => s.branch === branch);
  if (!stage) {
    const known = stages.map((s) => s.branch).join(", ");
    throw new Error(`No pipeline stage maps to branch "${branch}" (known: ${known})`);
  }
  return { testLevel: "RunLocalTests", ...stage };
}
