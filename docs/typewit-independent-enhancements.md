# TypeWit independently implemented enhancements

This branch remains a **draft release candidate, not production-ready**. See [release checklist](typewit-release-checklist.md) and [staging gates](typewit-staging-release-gate.md).

## Implemented

- TypeWit identity constants, responsive account management, clear loading/empty/error states, and an authenticated account directory with cursor pagination.
- Primary-admin-only account creation: regular users only, exact canonical address, one owned personal mailbox, bcrypt hashing, strict JSON/origin/body validation, atomic database creation and explicit provisioning state.
- Active/disabled management applies only to regular accounts created by this endpoint. Primary/admin and incomplete-provisioning accounts cannot be enabled through it. Disabling revokes sessions/device keys; session resolution rejects disabled/deleted users.
- Failure recovery restores provider rules before removing accounts. Uncertain cleanup retains a disabled account, returns its ID and writes an operational event without message content or credentials.
- Independent forwarding configuration and UI. A destination must be verified by Cloudflare, belong to an external domain and be authorized by the primary administrator. A source must be a Cloudflare mailbox on an administrator-owned domain. Rules can be disabled without a working provider. Forwarding adds loop headers, skips previously forwarded/automatic mail and logs only event names/mailbox IDs. Local copies are always retained. Provider rejection is recorded; automatic re-forwarding retries are not implemented.
- Forwarding is **off unless `TYPEWIT_FORWARDING_ENABLED=true`** and remains off in staging. The live handler hook is inert by default. Node/relay provider adapters do not implement this TypeWit forwarding path yet. Do not advertise it as provider-independent or enable it before delivery acceptance.
- Additive TypeWit account/forwarding tables and migrations for SQLite/D1, PostgreSQL and MySQL, with optional backup coverage and old-backup restoration tests. SQLite's historical snapshot is stale; its migration is deliberately hand-written instead of regenerating/removing unrelated tables.
- Configurable email Worker routing target (default remains `mailflare`); staging explicitly targets its own Worker and blocks TypeWit account creation that would mutate Cloudflare routing.
- Source and compiled staging binding checks reject additional databases, buckets, queue consumers/producers, service overrides, production identifiers and provider variables.

## Licensing

`LICENSE` and upstream copyright notices remain intact. No license validation, entitlements, payment verification, licensed account endpoints or licensed forwarding settings were altered. TypeWit modules were independently written against publicly licensed database/authentication and provider APIs. Network users must be offered corresponding source for the version served under AGPLv3 §13, including modifications and build/install instructions. The auth screen links to this public repository; the release operator must publish the exact deployed commit and its build/configuration instructions, preserving notices and excluding credentials/customer data. TypeWit ownership of its additions does not remove the combined program's applicable AGPL obligations or grant rights to proprietary Pro/Team code.

## Known limits that block release

Remote staging resources/permissions and GitHub environment approval settings have not been verified in this session. Real delivery, browser-based responsive/accessibility checks, production backup/version capture and rollback rehearsal remain outstanding. Repository-wide lint still fails. Concurrent TypeWit duplicate creation is tested; cross-endpoint races with upstream mailbox/alias creation still need a shared atomic address-claim design. Existing preflight checks alone cannot establish that stronger guarantee. Forwarding currently supports the live Cloudflare email event only, with keep-copy failure handling instead of durable retry delivery.
