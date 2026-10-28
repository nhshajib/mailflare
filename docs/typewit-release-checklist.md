# TypeWit release candidate checklist

Production deployment is not authorized. PR #3 must remain draft. This branch is not yet a production-ready release candidate.

## Completed and locally verified — 2026-10-28

- [x] Inspect latest development branch and existing TypeWit account/staging code.
- [x] Preserve upstream license/entitlement checks and add a public source-code link.
- [x] Remediate dependency audit: initially 42 production entries, now zero across production **and development** dependencies.
- [x] Refresh manifest/lockfile; verify fresh `npm ci`, including native SQLite.
- [x] Replace TypeWit account source regex checks with executable database/HTTP tests.
- [x] Harden account provisioning/state/cleanup, primary-admin authorization, password byte limits, request limits, status management and session invalidation.
- [x] Add separately owned Cloudflare forwarding API/UI and disabled-by-default live handler hook, with destination verification, loop/local-domain checks and local-copy preservation.
- [x] Add additive migrations for D1/SQLite, PostgreSQL and MySQL and backup/old-restore coverage.
- [x] Harden staging source/generated artifact checks and configure the correct Worker routing target.
- [x] TypeScript passes. New TypeWit modules pass scoped lint.
- [x] Full automated suite: **391 passed, 2 intentional skips, 0 failed** (393 tests). Skips are existing SQLite schema-history checks; executable backup tests cover both pre/post TypeWit migration states.
- [x] Production and isolated staging Worker builds pass; generated staging artifact passes binding validation.
- [x] Real local Worker/D1 smoke passes: admin/user logins, two distinct personal mailboxes, own-message access, denied cross-user message reads and admin APIs, disabled-login rejection. Synthetic fixtures cleaned up. No external delivery.
- [x] CI includes types, lint, full tests, audit, both builds, artifact validation and real local Worker smoke. Manual staging deployment depends on all gates.
- [x] Document licensing/source availability, observability, secure staging requirements and production/rollback plan.

## Outstanding release blockers

- [ ] Repository-wide lint: 91 existing errors outside new TypeWit modules (React effect/ref/purity checks and existing type issues). It remains blocking; no rules/assertions were disabled. This is implementation work, not a missing credential.
- [ ] Shared atomic normalized-address claims across all mailbox/alias/account creation endpoints. TypeWit duplicate requests and existing alias collisions are covered, but concurrent creation through different APIs is not proven safe.
- [ ] Real Cloudflare resource/binding/credential scope checks, GitHub environment approvals and Actions results. Git access works; GitHub GraphQL returned Forbidden; no callable Cloudflare app or credential binding was available. Draft network additions and staging-token requirement are saved but do not grant access or contain a token value.
- [ ] Real staging Worker deploy and test-only-domain mail delivery. TypeWit staging Cloudflare-routing mutations and forwarding remain disabled. A verified isolated-domain policy is required before enabling them.
- [ ] Forwarding durable retries/duplicate-event policy, provider/Node adapter coverage and remote acceptance. Current Cloudflare event path keeps the local original on failure and has no automatic retry queue or exactly-once forwarding guarantee.
- [ ] Real browser mobile/desktop/keyboard/accessibility validation. UI code has responsive layouts, semantic labels and status/empty states; code inspection is not browser evidence.
- [ ] Remote production version/backup capture and staging rollback rehearsal. Only local backup/restore was exercised. Production deployment requires separate final approval.
- [ ] GitHub PR body and CI metadata verification through authorized API access. Pushing the development branch updates its existing draft diff; it does not establish CI success or change its review state.

Use [staging and release gates](typewit-staging-release-gate.md) for exact external prerequisites and command replay, [dependency audit](typewit-dependency-security-audit.md) for package rationale, and [feature notes](typewit-independent-enhancements.md) for implementation limits.
