#!/usr/bin/env bash
# Rollback preview: resolve refs, compute reverse delta, safety analysis, validate.
# Env: ROLLBACK_ENV, TARGET_SEQ, INCLUDE_DESTRUCTIVE. Writes rollback-refs.env
# (sourceable) and reverse-delta/ for execute.sh to reuse.
set -euo pipefail

node --input-type=module -e "
  const {resolveRollbackRefs}=await import('./scripts/rollback/refs.mjs');
  const {execSync}=await import('node:child_process');
  const {writeFileSync}=await import('node:fs');
  const tags=execSync('git tag -l \"deploy/${ROLLBACK_ENV}/*\"').toString().split('\n').filter(Boolean);
  const r=resolveRollbackRefs(tags,'${ROLLBACK_ENV}','${TARGET_SEQ}');
  const lines=[
    'CURRENT_TAG='+r.currentTag, 'TARGET_TAG='+r.targetTag,
    'CURRENT_SEQ='+r.current, 'NEW_SEQ='+r.newSeq, 'NEW_TAG='+r.newTag,
  ].join('\n')+'\n';
  writeFileSync('rollback-refs.env', lines);
  console.log('Rolling back '+r.currentTag+' -> '+r.targetTag+' (new '+r.newTag+')');
"
# shellcheck disable=SC1091
source rollback-refs.env

rm -rf reverse-delta && mkdir -p reverse-delta
sf sgd source delta --from "$CURRENT_TAG" --to "$TARGET_TAG" --output-dir reverse-delta

node scripts/rollback/analyze.mjs reverse-delta \
  --env "$ROLLBACK_ENV" --from "$CURRENT_SEQ" --to "$TARGET_SEQ" \
  --include-destructive "$INCLUDE_DESTRUCTIVE" \
  --out-md preview.md --out-json safety.json
cat preview.md >> "${GITHUB_STEP_SUMMARY:-/dev/stdout}"

# Validate against the org (dry-run has check-only semantics and accepts NoTestRun).
DESTRUCTIVE_ARGS=()
if [ "$INCLUDE_DESTRUCTIVE" = "true" ] && \
   [ -f reverse-delta/destructiveChanges/destructiveChanges.xml ] && \
   grep -q "<members>" reverse-delta/destructiveChanges/destructiveChanges.xml; then
  DESTRUCTIVE_ARGS=(--post-destructive-changes reverse-delta/destructiveChanges/destructiveChanges.xml)
fi
if [ -s reverse-delta/package/package.xml ] && grep -q "<members>" reverse-delta/package/package.xml; then
  MANIFEST_ARGS=(--manifest reverse-delta/package/package.xml)
else
  # Reverse delta may be pure-destructive (nothing to restore) — build an empty manifest.
  mkdir -p reverse-delta/package
  printf '<?xml version="1.0" encoding="UTF-8"?>\n<Package xmlns="http://soap.sforce.com/2006/04/metadata"><version>64.0</version></Package>\n' \
    > reverse-delta/package/package.xml
  MANIFEST_ARGS=(--manifest reverse-delta/package/package.xml)
fi

echo "Validating rollback against the org (dry-run)…"
sf project deploy start --dry-run --ignore-conflicts \
  "${MANIFEST_ARGS[@]}" "${DESTRUCTIVE_ARGS[@]}" \
  --test-level NoTestRun --target-org target-org --wait 60 --json > validate.json || true
node scripts/deploy/parse-validate-result.mjs validate.json --errors verrors.md
echo "Preview complete." >> "${GITHUB_STEP_SUMMARY:-/dev/stdout}"
