# TypeWit Mail dependency security findings — 2026-10-28

The GitHub Actions production-dependency audit (`npm audit --omit=dev --audit-level=high`) **failed** in run [#40693469823](https://github.com/nhshajib/mailflare/actions/runs/40693469823).

## Reported affected packages

- `next`: **critical**. Audit suggests a newer version outside the currently stated dependency range; confirm integration with vinext before upgrading.
- `dompurify`: **critical**; audit reports compatible remediation available.
- `@modelcontextprotocol/server`: **high**; audit reports compatible remediation available.
- `undici`: **high**; audit reports numerous network / decompression / cache advisories.
- `sharp`: **high** via `miniflare` in toolchain.
- `source-map-js`: **high**; audit reports compatible remediation available.
- `nodemailer`, `fast-uri`: moderate; audit reports remediation available.
- `fflate` via `satori` / `@vercel/og` / `vinext`: moderate and may need incompatible upstream changes.

## Release disposition

**STOP SHIP.** Do not disable the audit gate to achieve green CI. Determine which packages are runtime reachable, update non-breaking packages and regenerate lockfile, retest, and document remaining exceptions only when justified by concrete deployment architecture. Avoid `npm audit fix --force` because it may switch vinext/Next builds incompatibly.

The existing GitHub integration in this conversation supports editing tracked repository files, but not running `npm install` to regenerate and commit a verified lockfile. Any dependency upgrade needs a tested lockfile update before release.

Additionally, staging has not yet been deployed; two-account authentication and mailbox isolation remain untested. This document does not assert production impact for every advisory; the audit finding is a release blocker pending triage.
