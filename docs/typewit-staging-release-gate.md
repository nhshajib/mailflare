# TypeWit staging release gate

This document describes requirements for the **draft PR**. Passing a Vite build does **not** mean it is production-ready.

## Isolation
- Production Worker: `mailflare`; **never deploy** `wrangler.jsonc` during staging.
- Staging Worker: `typewit-mail-staging` on workers.dev, no custom routes or cron.
- Staging database: `typewit-mail-staging`; staging bucket: `typewit-mail-staging-raw`.
- Staging queues: `typewit-mail-staging-inbound`, `typewit-mail-staging-outbound`, `typewit-mail-staging-agent`.
- Do not reuse production `CF_TOKEN`, `CF_API_KEY`, `RESEND_API_KEY`, domain routing, Turnstile secrets or live account data.
- Do not create Cloudflare email routing rules for `typewit.com` from staging.

## Human-controlled GitHub setup (required)
1. In repository Settings → Environments, create `typewit-staging`. Require reviewer approval before deployment.
2. Set **environment** secret `CF_TYPEWIT_STAGING_API_TOKEN` to a reviewed, narrowly scoped Cloudflare API token. Never commit or paste the token into a PR.
3. Set **environment** variable `CF_TYPEWIT_STAGING_ACCOUNT_ID` to the Cloudflare account that owns the already-provisioned staging resources. The workflow validates this identifier.
4. Keep this PR draft. Do not merge it solely to expose a workflow-dispatch button. Trigger the dedicated staging workflow only once it is available and approved; GitHub may require a workflow file on the default branch before dispatch.
5. Inspect Cloudflare token scopes before running migrations/deployment. Ensure the token cannot edit DNS or Email Routing for production zones.

## Automated staging workflow
`.github/workflows/typewit-staging-deploy.yml` executes *only by manual workflow_dispatch* on the development branch, then:
- Runs TypeWit regression checks and the Vite build with `CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH=./wrangler.staging.jsonc`.
- Verifies generated `dist/server/wrangler.json` references staging resources.
- Requires staging environment API token and account ID.
- Applies D1 migrations to staging only, then deploys compiled staging Worker.

**Never bypass a failing check with a production token.**

## Pre-production acceptance checklist (not yet passed)
- [ ] Staging Worker deploys and serves login without any production secrets.
- [ ] D1 migration log confirms only staging database was touched.
- [ ] Staging admin creates two ordinary accounts with distinct personal mailboxes.
- [ ] Each user logs in, sees own mailbox only, and cannot read another user's messages by direct URL/API.
- [ ] Non-admin requests to `/api/typewit/accounts` cannot list or create accounts.
- [ ] Cross-site requests and invalid domains are refused.
- [ ] A failure during email routing leaves no enabled unauthorized account; partial cleanup is detectable.
- [ ] Concurrent creation of same normalized address results in one account only; aliases are checked.
- [ ] Send/receive tests use a test-only domain and provider. No live routing changes.
- [ ] Dependency vulnerabilities reviewed and remediation documented.
- [ ] AGPLv3 obligations and source distribution reviewed.
- [ ] Review backup and rollback strategy; schedule controlled production rollout separately.

Until every item is verified, **do not merge the PR or deploy to production**.
