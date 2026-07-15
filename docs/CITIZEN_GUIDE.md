# OrbitOps — Builder's Guide

You build in Salesforce with clicks; OrbitOps gets your work safely from your
org to production. No Git, no command line — everything happens at
http://localhost:3000 (the OrbitOps app).

## The journey

### 1. Start a change
Pipeline page → **Start a change**. Enter your work item ID (like `PROJ-123`
from Jira or `AB#456` from Azure DevOps) and a one-line description. You land
in your change's workspace, and the change appears on the board under
**Changes being built**.

### 2. Build in your org
Do your normal work in Setup — fields, flows, layouts, validation rules.
If your org isn't connected yet: Settings → **Connect an org** → sign in on
Salesforce's login page (OrbitOps never sees your password).

### 3. Pull my changes
Back in your change's workspace, pick your org and click **Pull my changes**.
A minute later your edits appear as a friendly list ("Field 'Discount' on
Clinic — added"). Untick anything that isn't part of your work item and
**Remove selected** — shared orgs often contain other people's edits too.

### 4. Submit for promotion
When the list looks right, **Submit for promotion**. OrbitOps starts the
checks automatically:

- **What will deploy** — the exact contents, listed
- **Work items** — your change is tagged to your ticket
- **Code scan** — security/quality rules on anything code-like
- **Validate against target org** — Salesforce test-applies the change
- **Coverage gate** — test coverage where required

### 5. Promote
When every check is green, **Promote to Integration**. Promotion to UAT and
Production works the same way, but a release manager approves before anything
touches those orgs. You can watch "Releasing…" on the board, and the release
lands in **Deployment history** with your work item on it.

### If something goes wrong
- **"Some checks need attention"** — open the change; each failing check
  explains itself in plain language.
- **"This change overlaps with another change"** — click **Ask a developer
  for help**; conflicts need a developer's judgment.
- **A release caused problems** — a release manager uses **Back out a
  release**: pick the release to return to, preview exactly what changes
  (with warnings), confirm. Configuration is restored; data is not.

## Good habits
- One work item per change — small changes promote fastest.
- Pull your changes often; the preview list is your safety net.
- Read the deletion warnings when backing out — deleted fields lose their data.
