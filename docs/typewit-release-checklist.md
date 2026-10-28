# TypeWit release candidate checklist

The repository now passes its local release gates. **Production readiness still requires remote acceptance.** Production deployment is not authorized; PR #3 must remain draft.

## Locally completed — 2026-10-28

- [x] Fresh lockfile installation, including native SQLite and locked browser-test tooling.
- [x] Zero advisories in the full dependency audit; no advisory exclusions or disabled integrity/TLS checks.
- [x] Repository-wide lint and TypeScript pass. Existing nonblocking warnings remain visible; no lint rules were disabled or downgraded.
- [x] Repair entity-scoped draft resets, hydration-safe preferences, asynchronous fetch lifecycles, pagination/selection, compose signatures, callback purity and mailbox-form default handling.
- [x] StrictMode/draft/hydration regression tests and the complete existing automated suite pass.
- [x] Primary-admin authorization, password hashing, session revocation, disabled/deleted account denial, strict JSON/origin/body validation and recoverable provisioning.
- [x] Shared database-enforced normalized address claims across mailbox, alias and account writes, with transaction rollback and cascade-deletion cleanup tests. Legacy collisions deliberately block migration and are detected by a read-only preflight.
- [x] Independent verified-destination forwarding, loop/local-domain checks, durable duplicate-attempt reservations, failed/pending/delivered counters and local-original persistence before optional forwarding. Failed/uncertain deliveries retain their reservation and original for manual recovery; automatic blind re-forwarding is intentionally unsupported.
- [x] SQLite/D1, PostgreSQL and MySQL migrations and matching triggers. Backup/restore covers new forwarding state; derived claims rebuild on restore and older backups remain supported.
- [x] PostgreSQL/PGlite smoke: 35 checks pass, including address claims, migration replay, triggers, search and backup/restore. Real MySQL execution remains outside the tested Cloudflare workflow.
- [x] Production and isolated staging Worker builds and strict generated-binding validation pass locally.
- [x] Real local Worker/D1 HTTP smoke: administrator/user login, two personal mailboxes, own-message access, denied cross-user reads/admin APIs and disabled-login rejection. Synthetic fixtures are cleaned up.
- [x] Chromium desktop/mobile smoke: login, visible/actionable account controls, labels, keyboard focus, no horizontal overflow/client exceptions and mailbox-creation form defaults. This is targeted acceptance, not a full manual accessibility audit.
- [x] CI gates include fresh installation, lint, types, full tests, audit, production/staging builds, artifact isolation, Chromium/local Worker and PostgreSQL checks. Staging deployment stays manual and depends on every gate.
- [x] Upstream entitlement checks and license notices preserved; source-availability and rollout/rollback requirements documented.
- [x] Reusable environment install/start instructions updated and saved as a draft. This does not apply or publish environment changes.

## Remote release gates — still unverified

- [ ] Read actual GitHub Actions results/PR metadata on the final pushed SHA. Git push access works; GitHub API access was forbidden in this session. No CI success is inferred from local results.
- [ ] Verify Cloudflare staging resources, credential scopes, environment reviewer protection and all bindings through authorized access. The tagged app still exposes no callable tools here and the runtime has no configured credential binding. The saved draft declares the restricted staging-token requirement and API network additions; it contains no token value.
- [ ] Select a disposable test domain separate from production, with isolated provider credentials. Current staging safeguards intentionally block Cloudflare routing mutations and live TypeWit forwarding until an explicitly scoped test-domain policy is reviewed.
- [ ] Deploy isolated staging after all automated gates pass and verify real inbound/outbound mail, attachments, queues/retries, forwarding, duplicate delivery and provider failure behavior with synthetic accounts only.
- [ ] Run the address-collision preflight against the target installation before migration. Never remediate by silently deleting accounts or disabling the unique ledger.
- [ ] Capture the production Worker version and private backups with authorized read-only operations; rehearse recovery/rollback in staging. Local backup tests do not establish remote recovery readiness.
- [ ] Ensure corresponding source for the exact release is accessible to every network user, retain notices, and complete final review. Keep PR #3 draft until acceptance is recorded.
- [ ] Obtain the user's separate, explicit final approval before production deployment. No production Worker, DNS/MX, Email Routing or live provider setting has been changed.

See [feature behavior and delivery policy](typewit-independent-enhancements.md), [staging/release gates and replay](typewit-staging-release-gate.md) and [dependency audit](typewit-dependency-security-audit.md). Final command outcomes are recorded in the commit/PR update summary; remote results remain unknown until observed.

## Final local evidence for this update

| Check | Observed result |
| --- | --- |
| Fresh `npm ci` | Passed; 866 locked packages installed |
| `npm run lint` | Passed with warnings; no rules disabled |
| `npx tsc --noEmit` | Passed |
| `node --test tests/*.test.mjs` | 401 tests: 399 passed, 2 intentional skips, 0 failures |
| `npm audit --audit-level=high` | Zero vulnerabilities, including development dependencies |
| Production Worker build | Passed; no deployment |
| Staging Worker build and artifact validator | Passed; no deployment |
| PostgreSQL/PGlite smoke | All 35 checks passed |
| Real local Worker and Chromium smoke | Desktop/mobile login, account UI, mailbox isolation, input labels, keyboard focus, mailbox-form defaults and disabled login passed |
| D1 migrations | Applied only to local staging state; no remote database operation |
| Collision preflight/failure recovery | Count-only detection, failed-migration rollback and preserved legacy rows passed |

The two skips are the pre-existing SQLite schema-history checks, not newly disabled tests. Executable coverage validates current SQLite migrations, backup/restore, derived claims and pre-TypeWit backup compatibility. These results describe the local environment; remote Actions/staging/delivery/rollback results are not inferred.
