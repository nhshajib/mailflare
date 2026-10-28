# TypeWit staging and production release gate

**Do not merge PR #3 or deploy production yet.** Production Worker `mailflare`, DNS/MX, Email Routing and live mail-provider settings must remain unchanged during acceptance work.

## Automated checks

`typewit-checks.yml` runs on all PR changes, development-branch pushes and manual/reusable invocations. Independent matrix jobs run frozen dependency installation, TypeScript, unrestricted repository lint, full unit/database/HTTP tests, all-dependency security audit, production build, isolated staging build/artifact checks and the real local Worker smoke test. Failing lint is not excluded or downgraded. Actions are pinned to commit SHAs and checkout credentials are not retained.

The manual staging workflow is restricted to `feature/typewit-independent-enhancements`, depends on the entire check workflow, and uses the protected `typewit-staging` environment. It validates source/build isolation, account target and credential presence before migrations or deployment. No production deployment workflow has been added.

## Missing external prerequisites

1. Provide callable Cloudflare access or securely configure a separate `CF_TYPEWIT_STAGING_API_TOKEN`. The cloud-environment draft declares this binding for `api.cloudflare.com`; no value was supplied. Review/save the draft settings and publish the environment when appropriate. The API network additions `api.cloudflare.com` and `api.github.com` are saved draft changes, not proof of runtime access.
2. Verify account `a23bb81df9913653447e932debbe887c`, D1 `6b12d806-054a-4953-918b-a5eb67877f21`, bucket `typewit-mail-staging-raw`, and the three `typewit-mail-staging-{inbound,outbound,agent}` queues. Read back configuration rather than assuming this file proves resource existence.
3. Create/verify GitHub environment `typewit-staging` with a required reviewer; store **environment secret** `CF_TYPEWIT_STAGING_API_TOKEN` and **environment variable** `CF_TYPEWIT_STAGING_ACCOUNT_ID`. Cloud-environment secret configuration does not create GitHub secrets. Token scopes must exclude production DNS/Email Routing changes; review Cloudflare account-level Worker/D1/R2/queue permissions before use. Do not supply production provider credentials to staging.
4. Restore authorized GitHub API access to inspect PR metadata/Actions logs and record CI results on the reviewed SHA. Existing HTTPS Git proxy authentication does not establish API permission.
5. Select a disposable test domain separate from `typewit.com`, with synthetic accounts and isolated provider credentials. Current `TYPEWIT_STAGING=true` intentionally blocks TypeWit Cloudflare-routing mutations and live forwarding. Only add an explicit reviewed test-domain policy after credential/resource isolation is verified; do not remove the guard globally to obtain a passing test.

## Acceptance still required

- Resolve repository-wide lint and review cross-endpoint address races.
- Inspect remote staging bindings/token scopes before any remote operation; deploy staging only after every automated gate passes.
- Verify remote login, two-user message/attachment isolation, inbound/outbound queues, duplicate delivery, failures, retries and forwarding with synthetic mail only. The local tests do not establish remote delivery.
- Complete desktop/mobile keyboard and accessibility testing in a real browser.
- Recheck advisories and AGPL source availability on the final reviewed commit.
- Rehearse the backup and rollback procedure below in staging. Keep the PR draft until all requirements pass.

## Production plan and rollback (not executed)

1. Record the current production Worker deployment/version ID and binding configuration through read-only inspection. Export D1 and inventory/back up R2 to operator-controlled private storage; do not copy customer mail or secrets into staging. Verify backup integrity and recovery independently with synthetic data.
2. Check for normalized address collisions before migration, obtain application maintenance/backup sign-off, and apply only reviewed additive migrations after explicit production approval. Never run remote production commands as a staging check.
3. Publish the exact release commit and corresponding source/build instructions. Review the final PR and authorize production separately; pin the deployment artifact to that SHA. Forwarding remains off by default.
4. Following approval and deployment, verify login, ordinary-user isolation, receive/send/reply/attachments and queue errors using approved operational checks. Record version IDs and times.
5. If regression occurs, stop rollout, disable the new forwarding flag if enabled and restore the previously recorded Worker version with its original bindings. The new tables are additive; do not drop them or blindly restore an old database over new mail. If data corruption requires recovery, stop writers, preserve a post-failure copy and use the reviewed backup/restore procedure. A Worker rollback cannot undo mail already forwarded or arbitrary data mutations.

No production version ID, remote backup verification or rollback rehearsal is claimed. Those require authorized remote access and separate production approval.

## Local replay (verified)

From `/workspace/mailflare`, run `npm ci`, `npm run db:bundle`, `node --test tests/*.test.mjs`, `npx tsc --noEmit`, `npm audit --audit-level=high`, and `npm run build`. Use `CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH=./wrangler.staging.jsonc npm run build`, then `node scripts/verify-typewit-staging-output.mjs` for staging compilation.

For the real local smoke test, stop any dev server for this same checkout, apply `npx wrangler d1 migrations apply DB --local --config wrangler.staging.jsonc`, start `CLOUDFLARE_VITE_WRANGLER_CONFIG_PATH=./wrangler.staging.jsonc npx vp dev --port 3001`, wait for `/api/setup/status` to return 200, and run `node scripts/typewit-local-smoke.mjs`. It creates randomly named synthetic local fixtures, exercises actual HTTP login/mailbox/message/status handlers and deletes its fixtures. It never uses `--remote`. Keep proxy/TLS trust and the environment's writable XDG/npm caches configured.
