#!/usr/bin/env bash
# Rollback execute: deploy the reverse delta, write a forward revert commit on the
# env branch, tag deploy/<env>/<newSeq>, and record a rollback manifest.
# Assumes preview.sh already ran in this job (reverse-delta/ + rollback-refs.env exist).
# Env: ROLLBACK_ENV, TARGET_SEQ, INCLUDE_DESTRUCTIVE, REASON, BRANCH.
set -euo pipefail
# shellcheck disable=SC1091
source rollback-refs.env

if [ "${ROLLBACK_NOOP:-false}" = "true" ]; then
  echo "No-op rollback — nothing to execute (no tag or commit created)." \
    >> "${GITHUB_STEP_SUMMARY:-/dev/stdout}"
  exit 0
fi

# 1. Deploy reverse delta to the org.
DESTRUCTIVE_ARGS=()
if [ "$INCLUDE_DESTRUCTIVE" = "true" ] && \
   [ -f reverse-delta/destructiveChanges/destructiveChanges.xml ] && \
   grep -q "<members>" reverse-delta/destructiveChanges/destructiveChanges.xml; then
  DESTRUCTIVE_ARGS=(--post-destructive-changes reverse-delta/destructiveChanges/destructiveChanges.xml)
fi
echo "Deploying rollback to the org…"
sf project deploy start --ignore-conflicts \
  --manifest reverse-delta/package/package.xml "${DESTRUCTIVE_ARGS[@]}" \
  --test-level NoTestRun --target-org target-org --wait 60 --json > deploy.json || true
node scripts/deploy/parse-validate-result.mjs deploy.json --errors derrors.md

# 2. Forward revert commit: branch force-app -> target state, keeping added-after-target
#    components unless destructive was requested (so git matches org state).
git config user.name "orbitops-bot"
git config user.email "orbitops-bot@users.noreply.github.com"
git checkout "$TARGET_TAG" -- force-app
if [ "$INCLUDE_DESTRUCTIVE" != "true" ]; then
  git diff --name-only --diff-filter=A "$TARGET_TAG" "$CURRENT_TAG" -- force-app | while read -r f; do
    [ -n "$f" ] && git checkout "$CURRENT_TAG" -- "$f"
  done
fi
git add -A force-app
if git diff --cached --quiet; then
  echo "No git changes needed (org-only destructive rollback); creating empty marker commit."
  git commit -q --allow-empty \
    -m "Roll back $ROLLBACK_ENV to seq ${TARGET_SEQ}" \
    -m "Reason: ${REASON}" \
    -m "Rolled back from ${CURRENT_TAG} to ${TARGET_TAG}." \
    -m "Work-Items: POC-0"
else
  git commit -q \
    -m "Roll back $ROLLBACK_ENV to seq ${TARGET_SEQ}" \
    -m "Reason: ${REASON}" \
    -m "Rolled back from ${CURRENT_TAG} to ${TARGET_TAG}." \
    -m "Work-Items: POC-0"
fi
git push -q origin "HEAD:$BRANCH"

# 3. New deploy tag on the revert commit.
git tag -a "$NEW_TAG" -m "OrbitOps rollback: ${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}"
git push -q origin "$NEW_TAG"

# 4. Rollback manifest on the orbitops-meta branch.
node scripts/deploy/manifest.mjs --env "$ROLLBACK_ENV" --seq "$NEW_SEQ" \
  --sha "$(git rev-parse HEAD)" --delta-dir reverse-delta --type rollback \
  --run-url "${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}" \
  --actor "$GITHUB_ACTOR" --timestamp "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --extra "{\"rolledBackFrom\": ${CURRENT_SEQ}, \"rolledBackTo\": ${TARGET_SEQ}, \"reason\": \"${REASON//\"/\\\"}\", \"includeDestructive\": ${INCLUDE_DESTRUCTIVE}}" \
  --out manifest.json

for attempt in 1 2 3; do
  git fetch -q origin orbitops-meta 2>/dev/null || true
  if git show-ref -q refs/remotes/origin/orbitops-meta; then
    git worktree add -q .meta origin/orbitops-meta
  else
    git worktree add -q --detach .meta
    git -C .meta checkout -q --orphan orbitops-meta
    git -C .meta rm -rfq . 2>/dev/null || true
  fi
  mkdir -p ".meta/deployments/${ROLLBACK_ENV}"
  cp manifest.json ".meta/deployments/${ROLLBACK_ENV}/${NEW_SEQ}.json"
  git -C .meta add -A
  git -C .meta commit -q -m "Record rollback $NEW_TAG"
  if git -C .meta push -q origin HEAD:orbitops-meta; then git worktree remove -f .meta; break; fi
  git worktree remove -f .meta; echo "meta race, retry $attempt"
done

node scripts/workitems/post-deployment.mjs manifest.json --status rolled-back || true
echo "✅ Rolled back $ROLLBACK_ENV to seq ${TARGET_SEQ} — new state $NEW_TAG" >> "${GITHUB_STEP_SUMMARY:-/dev/stdout}"
