import { eq, sql } from "drizzle-orm";
import { isUniqueConstraintError } from "@/lib/database-errors";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { domains, mailboxAliases, mailboxes, users, typewitAccounts } from "@/db/schema";
import { hashPassword } from "@/lib/auth/password";
import { rollbackEmailRoutingRuleChanges } from "@/lib/cloudflare-api";
import type { CfEmailRoutingRuleChange } from "@/lib/cloudflare-api.types";
import { normalizeRecipientLocalPart } from "@/lib/email/recipient-address";
import { createAuditLog } from "@/lib/mailboxes/audit";
import { newId } from "@/lib/ids";
import { ensureMailboxDomainRouting } from "@/lib/mailboxes/domain-addresses";

export const typewitCreateAccountSchema = z.object({
  domainId: z.string().min(1),
  username: z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9._%+-]+$/),
  password: z.string().min(12).max(128).refine((value) => new TextEncoder().encode(value).length <= 72, "Password must be at most 72 UTF-8 bytes"),
  name: z.string().trim().min(1).max(100).optional(),
}).strict();

/**
 * Independently implemented TypeWit user + personal mailbox creation.
 * Role and domain scope are deliberately fixed: regular user, exact address,
 * no shared access or automatic assignment across domains.
 */
export async function createTypewitAccount(
  env: CloudflareEnv,
  primaryAdminUserId: string,
  input: z.infer<typeof typewitCreateAccountSchema>,
): Promise<NextResponse> {
  const db = getDb(env);
  const username = normalizeRecipientLocalPart(input.username);
  if (!username || username !== input.username.toLowerCase()) {
    return NextResponse.json({ error: "Invalid mailbox username" }, { status: 400 });
  }

  const [domain] = await db.select().from(domains)
    .where(eq(domains.id, input.domainId)).limit(1);
  if (!domain || domain.userId !== primaryAdminUserId || domain.status !== "active") {
    return NextResponse.json({ error: "An active domain owned by the primary administrator is required" }, { status: 400 });
  }

  if (env.TYPEWIT_STAGING === "true" && domain.receivingProvider === "cloudflare") {
    return NextResponse.json({ error: "Live routing is disabled in staging; use an isolated non-Cloudflare test domain" }, { status: 503 });
  }

  const email = `${username}@${domain.hostname.toLowerCase()}`;
  const [existingUser] = await db.select({ id: users.id }).from(users)
    .where(sql`lower(${users.email}) = ${email}`).limit(1);
  if (existingUser) {
    return NextResponse.json({ error: "Address already registered" }, { status: 409 });
  }

  const [existingMailboxes, existingAliases] = await Promise.all([
    db.select({ localPart: mailboxes.localPart }).from(mailboxes)
      .where(eq(mailboxes.domainId, domain.id)),
    db.select({ localPart: mailboxAliases.localPart }).from(mailboxAliases)
      .where(eq(mailboxAliases.domainId, domain.id)),
  ]);
  if ([...existingMailboxes, ...existingAliases].some(
    (entry) => normalizeRecipientLocalPart(entry.localPart) === username
  )) return NextResponse.json({ error: "Address already assigned" }, { status: 409 });

  const userId = newId("usr");
  const mailboxId = newId("mbx");
  const mailbox = {
    id: mailboxId,
    userId,
    domainId: domain.id,
    localPart: username,
    displayName: input.name ?? username,
    useAllDomains: false,
  };
  const changes: CfEmailRoutingRuleChange[] = [];
  let inserted = false;
  try {
    const passwordHash = hashPassword(input.password);
    // Both records must commit together so a user is never created without a mailbox.
    await db.batch([
      db.insert(users).values({
        id: userId, email, passwordHash, name: input.name ?? username,
        role: "user", createdByUserId: primaryAdminUserId, disabled: true,
      }),
      db.insert(mailboxes).values(mailbox),
      db.insert(typewitAccounts).values({ userId, state: "provisioning" }),
    ]);
    inserted = true;
    await ensureMailboxDomainRouting(env, db, mailbox, changes);
    // Activate only after all mailbox routing operations have succeeded.
    await db.batch([
      db.update(typewitAccounts).set({ state: "ready" }).where(eq(typewitAccounts.userId, userId)),
      db.update(users).set({ disabled: false }).where(eq(users.id, userId)),
    ]);
    await createAuditLog(env, { actorUserId: primaryAdminUserId, targetUserId: userId, mailboxId, action: "typewit.account.created" }).catch(() => {
      console.warn(JSON.stringify({ event: "typewit.account.audit_unavailable", userId }));
    });
    return NextResponse.json({
      account: { id: userId, email, name: input.name ?? username, role: "user" },
      mailbox: { id: mailboxId, address: email },
    }, { status: 201 });
  } catch (error) {
    if (!inserted) {
      if (isUniqueConstraintError(error)) {
        return NextResponse.json({ error: "Address already assigned" }, { status: 409 });
      }
      return NextResponse.json({ error: "Account setup failed before provisioning" }, { status: 502 });
    }

    // Disable the user immediately, then roll routing changes back before
    // removing its database records. On uncertain cleanup, keep the disabled
    // account for administrator investigation rather than leaving an orphan
    // route pointing at a deleted mailbox.
    try {
      await db.update(users).set({ disabled: true }).where(eq(users.id, userId));
      await rollbackEmailRoutingRuleChanges(env, changes);
      await db.delete(users).where(eq(users.id, userId));
      return NextResponse.json({ error: "Account setup failed; changes were rolled back" }, { status: 502 });
    } catch {
      await db.update(typewitAccounts).set({ state: "cleanup_required" }).where(eq(typewitAccounts.userId, userId)).catch(() => undefined);
      console.error(JSON.stringify({ event: "typewit.account.cleanup_required", userId, mailboxId }));
      return NextResponse.json({
        accountId: userId,
        error: "Account setup failed and cleanup needs administrator review; do not retry until routing and account records are checked",
      }, { status: 502 });
    }
  }
}
