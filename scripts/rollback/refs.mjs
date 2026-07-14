/**
 * Resolves and validates the tag pair for a rollback.
 * current = latest deploy/<env>/<seq>; target = deploy/<env>/<targetSeq>.
 */
import { latestSeq } from "../deploy/next-seq.mjs";

export function resolveRollbackRefs(tags, env, targetSeq) {
  const current = latestSeq(tags, env);
  const target = Number(targetSeq);

  if (current === 0) throw new Error(`No deploys found for "${env}" — nothing to roll back.`);
  if (!Number.isInteger(target) || target < 1) throw new Error(`Invalid target sequence: ${targetSeq}`);
  if (!tags.includes(`deploy/${env}/${target}`)) {
    throw new Error(`Target deploy/${env}/${target} does not exist.`);
  }
  if (target >= current) {
    throw new Error(
      `Target seq ${target} must be older than the current seq ${current}. ` +
        `Roll back to a PRIOR deployment.`
    );
  }
  return {
    env,
    current,
    target,
    currentTag: `deploy/${env}/${current}`,
    targetTag: `deploy/${env}/${target}`,
    newSeq: current + 1,
    newTag: `deploy/${env}/${current + 1}`,
  };
}
