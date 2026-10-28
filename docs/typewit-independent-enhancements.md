# TypeWit independent enhancement plan

This branch is **not production-ready**. It introduces a TypeWit-owned UI identity module without changing Mailflare's Pro/Team entitlement checks, license state, live Cloudflare infrastructure, database schema, or inbound/outbound handlers.

## 1. Branding
- Reuse `src/lib/typewit/identity.ts` for the sign-in page, page metadata, navigation, and other static TypeWit presentation text.
- Keep the existing licensed Mailflare branding API unchanged.
- Verify logo and icon paths exist and that accessibility text identifies TypeWit.
- Verify production and local asset URLs with a staged build before enabling.

## 2. Independent multi-user management
- Build a separate TypeWit admin API/UI, rather than modifying `getLicenseEntitlements()`.
- Reuse password-hashing and session mechanisms only after reviewing those security controls.
- Explicitly verify administrator permissions on every account mutation.
- Ensure users cannot enumerate or access one another's mailboxes, messages, API keys, or attachments.
- Handle account invitations, disabled accounts, password resets, ownership reassignment, and audit logs.
- Test malicious and cross-account requests against isolated D1/R2 fixtures.

## 3. Independent email forwarding
- Add a separate TypeWit forwarding configuration and its own authorization checks.
- Validate destinations, avoid forwarding loops, distinguish forward-only from keep-copy.
- Test failures and retry behavior with a fake outbound provider; never test against a production inbox.
- Do not modify `worker.ts`, the existing inbound queue consumer, or Cloudflare email routes until passing staged delivery tests.

## Production safety gates
1. Development branch only; Cloudflare production must deploy exclusively from `main`.
2. Create separate staging Worker, D1, R2, queues, and test domain; never bind the real production email domain to staging.
3. Run formatting, lint, type/build checks and authorization tests.
4. Back up production D1 and R2; validate recovery process.
5. Review AGPLv3 obligations and publication of corresponding source.
6. Review the PR and manually approve deployment; verify send, receive, reply, attachments, and login afterwards.

## Rollback
Keep the current production Worker deployment and all bindings unchanged. Roll back via the previous known-working deployment if a reviewed release regresses behavior.

## Current implementation
- Added independent presentation identity constants and title helper.
- No account management, forwarding functionality, or production deployment has been implemented yet.
