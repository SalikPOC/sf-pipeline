# Work-Item Traceability

Every change moving through the pipeline must be traceable to a Jira issue or
Azure DevOps work item. The PoC enforces the **conventions** (extraction +
format validation); live tracker APIs are post-PoC.

## Conventions (enforced by the "Work items" PR check)

A promotion PR must reference at least one work item, via any of:

| Where | Example |
|---|---|
| Branch name | `feature/PROJ-123-discount-field`, `feature/AB#456-routing` |
| PR title | `Add discount field (PROJ-123)` |
| Commit message footer | `Work-Items: PROJ-123, AB#456` |

ID formats: Jira `ABC-123` (uppercase project key + number) · Azure DevOps `AB#123`.

Commit **bodies** are not scanned (too noisy) — only footers, branch names, and
PR titles. The UI-driven flows generate these automatically; only pro-code
developers need to remember the convention.

## What gets recorded

Each deploy manifest (`orbitops-meta` branch, `deployments/<env>/<seq>.json`)
carries the work items found in the deployed commit range. On success, the
pipeline calls `postDeploymentStatus` for each — the PoC stub records to the
`workitem-postbacks` artifact instead of calling a tracker.

## Connecting Jira/ADO later (post-PoC)

Implement the `WorkItemAdapter` interface (`scripts/workitems/adapter.mjs`) per
tracker and extend `adapterFor` to route by ID pattern:

1. **JiraAdapter** — Jira Cloud REST v3; auth `JIRA_BASE_URL` + `JIRA_EMAIL` +
   `JIRA_API_TOKEN` (repo secrets). `validateId` = GET issue (E2.1 existence
   gate); `postDeploymentStatus` = Deployments API or fallback issue comment
   (E2.3); `getWorkItem` powers the UI panel (E2.4).
2. **AdoAdapter** — ADO REST 7.x; auth `ADO_ORG_URL` + `ADO_PAT` (Work Items
   read/write). Comment + "Integrated in build" link.
3. Optional status gate (E2.5): fail promotion unless all work items are in a
   configured status (`workItemStatus` in `.orbitops/pipeline.yml`).

Keep degradation graceful: absent tracker credentials must warn, never block a
deploy (`scripts/workitems/post-deployment.mjs` already never exits non-zero).
