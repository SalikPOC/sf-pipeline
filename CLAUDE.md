# OrbitOps — sf-pipeline

Salesforce CI/CD platform giving citizen developers a DevOps-Center-like experience
on GitHub Actions + Salesforce CLI, with UI-driven rollback, diff visibility,
configurable stage gates, static code analysis, and work-item traceability.
Full spec: `REQUIREMENTS.md` (epics E1–E9). This repo is the SFDX project +
pipeline machinery; the web UI lives in the separate `orbitops-ui` repo.

## Architecture summary

- GitHub is the source of truth; SFDX **source format**, single package dir `force-app`.
- **Branch-per-environment promotion**: `feature/*` → `integration` → `uat` → `main`.
  Every promotion is a PR. Stage config lives in `.orbitops/pipeline.yml`
  (schema: `.orbitops/schema/pipeline.schema.json`).
- **Delta deploys** via sfdx-git-delta; PR validation is check-only deploy
  (`sf project deploy validate`) with quick-deploy on merge when eligible.
- **Deploy history**: tag `deploy/<env>/<seq>` + GitHub Deployment + manifest JSON
  committed to the `orbitops-meta` branch.
- **Rollback** = reverse delta between deploy tags, validate-first, destructive
  changes opt-in, forward revert commit (never force-push).
- **Stage gates** = GitHub Environments (required reviewers) + in-workflow gates
  (minCoverage, scannerMaxSeverity) from pipeline.yml.
- **Work items**: Jira keys (PROJ-123) / ADO refs (AB#456) in branch names, PR
  titles, `Work-Items:` commit footers. PoC = format validation + stub adapter
  only; live Jira/ADO APIs are post-PoC (see E2 PoC-scope note).

## Key design decisions (D1–D9, see REQUIREMENTS.md §4)

D1 branch-per-env promotion · D2 source format, one package dir · D3 JWT org auth,
secrets in GitHub Environments · D4 standalone Next.js UI + GitHub App (runs on
localhost for PoC) · D5 work-item IDs in branch/PR conventions · D6 tracker adapter
interface (stub for PoC) · D7 Salesforce Code Analyzer v5 · D8 rollback is
metadata-only, validate-first with preview · D9 test level per stage
(RunLocalTests for uat/main).

## PoC environment

| Branch | Org key | Backing org | Notes |
|---|---|---|---|
| integration | INT | scratch `devopsDev1` | test.salesforce.com |
| uat | UAT | scratch `stagingscratch` | test.salesforce.com |
| main | PROD | dev org `DevOpsCenterDevHub` | also the Dev Hub |

## Stack

`sf` CLI v2 (pinned 2.142.7) · sfdx-git-delta 6.45.1 ·
@salesforce/plugin-code-analyzer 5.14.0 · GitHub Actions (reusable workflows) ·
Node ESM scripts with `node --test` units · composite action
`.github/actions/sf-auth` for CLI install + JWT auth.

## Conventions

- Use the `sf` CLI v2 only — never legacy `sfdx` commands. Parse `--json` output.
- Thin YAML, fat scripts: workflow logic lives in `scripts/**` (ESM, unit-tested
  with `node --test`); workflows call the scripts.
- Every workflow uploads a structured `orbitops-summary.json` artifact; the UI
  depends on it.
- Pin GitHub Action versions by commit SHA; pin CLI/plugin versions explicitly.
- Sticky PR comments: update in place via hidden marker, never spam new comments.
- Never force-push. Never bypass branch protection. Bot commits clearly attributed.
- Never commit secrets; `*.key`/`*.pem` are gitignored as a backstop.
- `GITHUB_TOKEN` permissions blocks: least privilege per workflow.
- Citizen-facing copy avoids Git jargon ("Promote", not "merge PR").
- Profiles are guardrailed metadata: excluded via `.forceignore`; prefer permission sets.

## Decisions

(append project decisions made during build sessions here)

- 2026-07-14: Jira/ADO live integration cut from PoC scope; keep ID conventions +
  stub adapter (REQUIREMENTS.md E2 PoC-scope note).
- 2026-07-14: UI runs on localhost for the PoC; GitHub App with webhooks disabled,
  polling only.
- 2026-07-14: `force-app` seeded with sample objects (BUP_Clinic__c, BUP_Policies__c)
  retrieved from the original scratch orgs, so the pipeline has real metadata to move.
- 2026-07-14: Repos live under the personal account `SalikPOC` (public, so branch
  protection + required-reviewer environments work on the free plan). No teams on
  personal accounts → PoC role mapping is username-list based (env vars in the UI,
  usernames in CODEOWNERS); swap to team slugs when moving to an org.
- 2026-07-14: Auth is split per stage (amends D3): PROD uses JWT via connected app
  "OrbitOps CI" (deployed, verified). Scratch orgs can't create connected apps
  (Spring '26 restriction) and ECA JWT setup isn't metadata-deployable, so
  integration/uat use `sf org login sfdx-url` with an SF_AUTH_URL environment
  secret, refreshed on scratch-org recreation. sf-auth action supports both.
- 2026-07-14: Secrets exist at two levels: repo-level org-prefixed (INT_/UAT_/PROD_)
  for PR validation jobs, environment-level unprefixed for deploy jobs — because
  environment secrets would trigger required-reviewer approval on every PR
  validation (docs/SETUP.md §5).
