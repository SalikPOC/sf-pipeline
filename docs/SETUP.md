# OrbitOps Platform Setup (platform owner)

One-time setup for a new pipeline repo. Everything here is clickable/one-liner;
nothing requires local Salesforce tooling except the certificate step.

## 1. Branches

From the repo's default branch (`main`), create the two lower environment branches
at the same commit:

```bash
git branch integration && git branch uat
git push origin main integration uat
```

## 2. Branch protection

For **each** of `main`, `uat`, `integration` (Settings → Branches → Add rule):

- Require a pull request before merging (no direct pushes)
- Require status checks to pass; select the `OrbitOps /*` checks once they exist
- Require conversation resolution
- Do NOT allow force pushes or deletions

## 3. GitHub Environments (stage gates)

Settings → Environments → New environment. Create exactly these names (they must
match `environment:` values in `.orbitops/pipeline.yml`):

| Environment | Required reviewers | Notes |
|---|---|---|
| `integration` | none | fast lane for citizen devs |
| `uat` | release-managers team | |
| `production` | release-managers team | consider also a wait timer |

## 4. Org authentication

Two methods, chosen per stage via the `auth-method` input of the
`.github/actions/sf-auth` composite action:

- **`jwt`** (production/persistent orgs): connected app + certificate, below.
- **`sfdx-url`** (scratch-org stages): orgs created after Salesforce's Spring '26
  change can't create connected apps (External Client Apps' JWT flow still needs
  UI steps, so it isn't scriptable either). Instead, store the CLI's auth URL:
  `sf org display -o <alias> --verbose --json` → `result.sfdxAuthUrl` → secret
  `SF_AUTH_URL` on that stage's environment. Refresh it whenever the scratch org
  is recreated.

### Connected app + JWT certificate (per persistent org)

1. Generate a keypair (or run `scripts/setup/provision-connected-app.mjs` when
   available, which automates steps 1–3):
   ```bash
   openssl req -x509 -sha256 -nodes -days 730 -newkey rsa:2048 \
     -keyout server.key -out server.crt -subj "/CN=orbitops-ci"
   ```
2. Deploy the connected app: the metadata lives at
   `force-app/main/default/connectedApps/` (certificate embedded, consumer key
   pre-set) together with the `OrbitOps_CI` permission set. Deploy both to each org
   and assign the permission set to the integration user.
3. Wait 2–10 minutes (connected app propagation), then test locally:
   ```bash
   sf org login jwt --client-id <consumer-key> --username <user> \
     --jwt-key-file server.key --instance-url <login-url>
   ```
4. **Never commit `server.key`.** `.gitignore` blocks `*.key`/`*.pem` as a backstop.

## 5. Secrets

Secrets exist at **two levels** with the same values:

- **Repository-level, org-key-prefixed** (`INT_SF_AUTH_URL`, `UAT_SF_AUTH_URL`,
  `PROD_SF_CLIENT_ID`, `PROD_SF_JWT_KEY`, `PROD_SF_USERNAME`,
  `PROD_SF_INSTANCE_URL`) — used by **PR validation** jobs. These must NOT be
  environment-scoped: environment secrets would trigger the environment's
  required-reviewer gate on every PR validation.
- **Environment-level, unprefixed** (below) — used by **deploy** jobs, which run
  inside the environment and are gated by its required reviewers.

### Environment-level (per GitHub Environment)

In each Environment (Settings → Environments → <env> → Add secret):

**JWT stages** (e.g. `production`):

| Secret | Value |
|---|---|
| `SF_CLIENT_ID` | Connected app consumer key |
| `SF_USERNAME` | Integration user username in that org |
| `SF_JWT_KEY` | Full contents of `server.key` (PEM, including BEGIN/END lines) |
| `SF_INSTANCE_URL` | `https://login.salesforce.com` (prod/dev orgs) or `https://test.salesforce.com` (sandboxes & scratch orgs) |

**sfdx-url stages** (e.g. `integration`, `uat`):

| Secret | Value |
|---|---|
| `SF_AUTH_URL` | `sf org display -o <alias> --verbose --json` → `result.sfdxAuthUrl` |

Environment-level (not repo-level) secrets matter: they're only exposed to jobs
that pass that environment's gate.

## 6. Org ↔ stage mapping

`.orbitops/pipeline.yml` maps branches to logical org keys and environments.
Current PoC mapping:

| Branch | Org key | Backing org | Login URL |
|---|---|---|---|
| `integration` | INT | scratch org (alias `devopsDev1`) | test.salesforce.com |
| `uat` | UAT | scratch org (alias `stagingscratch`) | test.salesforce.com |
| `main` | PROD | Developer org (alias `DevOpsCenterDevHub`) | login.salesforce.com |

> Scratch orgs expire. When recreating (`sf org create scratch -f
> config/scratch-def-int.json -a devopsDev1 -v DevOpsCenterDevHub
> --duration-days 30`), redeploy the connected app and update `SF_USERNAME` in the
> matching environment.

## 7. Roles (PoC: username lists)

The repo owner `SalikPOC` is a personal account, so GitHub teams are unavailable.
For the PoC, role mapping is by username:

- CODEOWNERS lists usernames directly (see `.github/CODEOWNERS`)
- Environment required reviewers: add users directly on the `uat`/`production`
  environments
- The UI maps roles from env vars (`ROLE_RELEASE_MANAGERS`, `ROLE_ADMINS`,
  comma-separated usernames; everyone else authenticated = citizen dev)

When moving to an org: create `citizen-devs`, `release-managers`,
`orbitops-admins` teams and switch CODEOWNERS + UI role mapping to team slugs.

## 8. Repo settings checklist

- Enable secret scanning + push protection (Settings → Code security)
- Disallow merge types other than **merge commit** (preserves Work-Items footers)
- Default branch: `main`
