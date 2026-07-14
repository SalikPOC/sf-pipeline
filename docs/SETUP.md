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

## 4. Connected app + JWT certificate (per org)

The pipeline authenticates with the JWT bearer flow: a connected app in each org
holds a certificate; GitHub holds the matching private key as a secret.

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

## 5. Secrets (per GitHub Environment)

In each Environment (Settings → Environments → <env> → Add secret):

| Secret | Value |
|---|---|
| `SF_CLIENT_ID` | Connected app consumer key |
| `SF_USERNAME` | Integration user username in that org |
| `SF_JWT_KEY` | Full contents of `server.key` (PEM, including BEGIN/END lines) |
| `SF_INSTANCE_URL` | `https://login.salesforce.com` (prod/dev orgs) or `https://test.salesforce.com` (sandboxes & scratch orgs) |

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

## 7. Teams (role mapping)

Create GitHub teams used by CODEOWNERS and the UI's role mapping:

- `citizen-devs`
- `release-managers` (also set as required reviewers in step 3)
- `orbitops-admins`

Then replace `ORG_PLACEHOLDER` in `.github/CODEOWNERS` with the org name.

## 8. Repo settings checklist

- Enable secret scanning + push protection (Settings → Code security)
- Disallow merge types other than **merge commit** (preserves Work-Items footers)
- Default branch: `main`
