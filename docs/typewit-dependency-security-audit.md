# TypeWit dependency security audit — 2026-10-28

A fresh `npm audit --omit=dev --json` initially reported 42 affected dependency entries (2 critical, 25 high, 15 moderate). These include transitive metavulnerabilities; they are not 42 distinct exploitable runtime issues.

After the committed manifest/lockfile updates, **both `npm audit --omit=dev --audit-level=high` and the full `npm audit --audit-level=high` report zero advisories**. This is the registry's result on this date, not a guarantee against future disclosures. CI audits all dependencies and does not suppress findings.

## Remediation

- Upgrade Next.js and its ESLint plugin from 16.3.3 to 16.4.3; remove `ignoreBuildErrors` from the Node build configuration.
- Upgrade DOMPurify to 3.4.17 and the MCP server SDK to 2.4.0.
- Refresh compatible dependency ranges in the lockfile, including Nodemailer, source-map-js, Sharp and related packages. Preserve integrity hashes and TLS verification.
- Upgrade Vite+ and its matching aliased Vite core together to 1.4.0, addressing development-only Vitest advisories. Keep the existing vinext/Cloudflare adapter versions; a framework migration is unnecessary for these fixes.
- Override Undici with compatible 7.30.1 for the Cloudflare emulator/toolchain: fixes EventSource, decompression, cache, TLS and WebSocket advisories. The older parent constraints otherwise retain an affected version.
- Override fflate with 0.8.2 for the Satori/OG dependency chain: addresses malformed ZIP64 decompression. No application ZIP API is replaced. These overrides are temporary constraints to review when parents adopt patched releases, not advisory exclusions.

## Verification

A fresh `npm ci` from the resulting lockfile succeeds, including native SQLite installation. Production and staging Worker compilation, TypeScript, executable account/forwarding/backup tests, and the full existing suite have passed. The local Worker smoke test exercises the actual vinext/Cloudflare runtime, database and authentication handlers. New TypeWit modules pass scoped lint. Repository-wide lint remains failing on existing React/compiler/type findings and remains a release blocker; it is not excused by a clean dependency audit.

Image rendering edge cases and real remote provider interactions still require isolated staging acceptance. No remote Worker was deployed and no production resource was accessed for this audit. Audit results and Actions execution must be checked again on the final reviewed commit.
