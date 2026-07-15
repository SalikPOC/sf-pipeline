# OrbitOps — Salesforce CI/CD for citizen developers

A DevOps-Center-like release platform built on **GitHub Actions + Salesforce CLI**,
with a companion web UI ([orbitops-ui](https://github.com/SalikPOC/orbitops-ui)).
Citizen developers build with clicks in their org, pull changes into a work-item
branch, promote through integration → UAT → production behind quality gates, and
can back out any release with a previewed, validate-first rollback.

- **Spec**: [REQUIREMENTS.md](REQUIREMENTS.md) (epics E1–E9, decisions D1–D9)
- **Platform-owner setup**: [docs/SETUP.md](docs/SETUP.md)
- **Operations**: [docs/RUNBOOK.md](docs/RUNBOOK.md)
- **Builder walkthrough**: [docs/CITIZEN_GUIDE.md](docs/CITIZEN_GUIDE.md)
- **Work-item conventions**: [docs/WORKITEMS.md](docs/WORKITEMS.md)

## How a deployment actually works

Everything runs on **GitHub-hosted Actions runners** — ephemeral `ubuntu-latest`
virtual machines that are created for each job and destroyed afterwards. Nothing
is deployed *from* GitHub's own infrastructure in a special sense: each job is a
fresh Linux VM with Node.js preinstalled, and the workflow installs the
Salesforce tooling itself.

The **Salesforce CLI is not preinstalled** on GitHub runners. Every workflow that
touches an org starts with the composite action
[`.github/actions/sf-auth`](.github/actions/sf-auth/action.yml), which:

1. Installs pinned tooling on the runner: `@salesforce/cli` **2.142.7**,
   `sfdx-git-delta` **6.45.1**, `@salesforce/plugin-code-analyzer` **5.14.0**
   (versions pinned so runs are reproducible; ~60–90 s per job).
2. Authenticates to the target org **JWT** (connected app + certificate, used
   for production) or **sfdx-url** (stored CLI auth URL, used for scratch-org
   stages) — credentials come from GitHub secrets, never the repo.

A promotion then flows like this:

```
PR opened (feature/* → integration, or integration → uat, …)
  └─ pr-validate.yml on a fresh runner:
       install CLI → auth to TARGET org → sfdx-git-delta computes the
       changed-components package → sf project deploy validate (check-only
       deploy: Salesforce compiles + runs tests in the org, commits nothing)
       → code scan, coverage gate, work-item check → sticky PR comment
PR merged ("Promote" in the UI)
  └─ deploy.yml on a fresh runner (gated by the GitHub Environment):
       quick-deploy the validated package if still eligible (no re-run of
       tests), else full delta deploy → tag deploy/<env>/<seq> → manifest
       committed to the orbitops-meta branch → GitHub Deployment recorded
```

Key properties:

- **Delta, not full deploys** — `sfdx-git-delta` diffs the two branches and
  builds a `package.xml` of only what changed (plus `destructiveChanges.xml`
  for deletions).
- **Validate-first** — the check-only deploy happens against the real target
  org at PR time; merge without green checks is impossible (branch protection).
- **Quick deploy** — Salesforce lets a validated deployment be applied within
  10 days without re-running tests; the pipeline stores the validation id and
  uses it on merge, falling back to a full deploy if anything drifted.
- **Gates** — GitHub Environments hold the deploy job until required reviewers
  approve (UAT/production); in-workflow gates enforce `minCoverage` and
  `scannerMaxSeverity` from [.orbitops/pipeline.yml](.orbitops/pipeline.yml).
- **Auditability** — every state change mints a `deploy/<env>/<seq>` tag and a
  JSON manifest on the `orbitops-meta` branch; the UI renders history, metrics,
  and rollback timelines purely from those manifests.

## Workflow inventory

| Workflow | Trigger | Purpose |
|---|---|---|
| `pr-validate.yml` | PRs to stage branches | Delta preview, work-item check, code scan, check-only deploy against the target org, coverage gate |
| `deploy.yml` | Push to stage branch (merge) | Quick-deploy or delta deploy, tag + manifest + Deployment, back-promotion PRs, optional failure webhook |
| `rollback.yml` | Manual / UI dispatch | Reverse delta between deploy tags; preview mode publishes a safety report, execute mode validates first then applies + revert PR |
| `retrieve.yml` | UI dispatch | "Pull my changes": retrieve a builder's edits from any registered/connected org into their work branch |
| `full-scan.yml` | Schedule + manual | Whole-repo Code Analyzer sweep → SARIF + burn-down issue |
| `snapshot.yml` | Nightly + manual | Drift detection: retrieve each stage org, diff vs its branch, auto-manage a "Drift report" issue |

All workflows follow "thin YAML, fat scripts": logic lives in `scripts/**`
(Node ESM, unit-tested via `node --test`), actions are SHA-pinned, and
`GITHUB_TOKEN` permissions are least-privilege per workflow (see the map in
[docs/RUNBOOK.md](docs/RUNBOOK.md)).

## Repo layout

```
.orbitops/            pipeline.yml (stages, gates, dev orgs) + JSON schema + scanner baseline
.github/workflows/    the six workflows above
.github/actions/      sf-auth composite action (CLI install + org auth)
scripts/              context/ deploy/ retrieve/ rollback/ scan/ lib/ — all workflow logic
force-app/            SFDX source (sample BUP_* objects, flows, classes)
docs/                 SETUP, RUNBOOK, CITIZEN_GUIDE, WORKITEMS
```
