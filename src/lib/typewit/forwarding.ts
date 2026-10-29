import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { domains, mailboxes, typewitForwarding, typewitForwardingAttempts, users } from "@/db/schema";
import { isUniqueConstraintError } from "@/lib/database-errors";
import { cfRequest } from "@/lib/cloudflare-api";
import { normalizeRecipientLocalPart } from "@/lib/email/recipient-address";

export const TYPEWIT_FORWARD_HEADER = "X-Typewit-Forwarded";
export const forwardingSchema = z.object({
  mailboxId: z.string().min(1).max(128),
  destination: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  enabled: z.boolean(),
}).strict();

export function normalizedForwardAddress(address: string): string | null {
  const parsed = z.email().safeParse(address.trim().toLowerCase());
  if (!parsed.success) return null;
  const at = parsed.data.lastIndexOf("@");
  return `${normalizeRecipientLocalPart(parsed.data.slice(0, at))}${parsed.data.slice(at)}`;
}

/** Verify against the provider at save time, rather than trusting a client-supplied flag. */
export async function verifiedForwardDestination(env: CloudflareEnv, destination: string): Promise<boolean> {
  if (!env.CF_ACCOUNT_ID || !/^[a-f0-9]{32}$/.test(env.CF_ACCOUNT_ID)) return false;
  const rows = await cfRequest<{ email: string; verified: string | null }[]>(env,
    `/accounts/${env.CF_ACCOUNT_ID}/email/routing/addresses?email=${encodeURIComponent(destination)}`);
  return rows.some((row) => row.email.toLowerCase() === destination && !!row.verified);
}

/** Disabled by default. Always keep the local copy, including on provider failure. */
export async function forwardTypewitMail(
  env: CloudflareEnv,
  message: Pick<ForwardableEmailMessage, "to" | "headers" | "forward">,
  raw: ArrayBuffer,
): Promise<boolean> {
  if (env.TYPEWIT_FORWARDING_ENABLED !== "true" || env.TYPEWIT_STAGING === "true") return false;
  if (message.headers.has(TYPEWIT_FORWARD_HEADER) || message.headers.has("X-Mailflare-Forwarded") || (message.headers.has("Auto-Submitted") && message.headers.get("Auto-Submitted")?.trim().toLowerCase() !== "no")) return false;
  const recipient = normalizedForwardAddress(message.to);
  if (!recipient) return false;
  try {
    const at = recipient.lastIndexOf("@");
    const [rule] = await getDb(env).select({ mailboxId: mailboxes.id, destination: typewitForwarding.destination })
      .from(typewitForwarding).innerJoin(mailboxes, eq(typewitForwarding.mailboxId, mailboxes.id))
      .innerJoin(domains, eq(mailboxes.domainId, domains.id)).innerJoin(users, eq(mailboxes.userId, users.id))
      .where(and(eq(domains.hostname, recipient.slice(at + 1)), eq(mailboxes.localPart, recipient.slice(0, at)),
        eq(typewitForwarding.enabled, true), eq(users.disabled, false), eq(mailboxes.disabled, false))).limit(1);
    if (!rule || normalizedForwardAddress(rule.destination) === recipient) return false;
    // Reject local destinations entirely. This prevents multi-rule cycles as well as self-loops.
    const destinationHost = rule.destination.slice(rule.destination.lastIndexOf("@") + 1);
    const [local] = await getDb(env).select({ id: domains.id }).from(domains).where(eq(domains.hostname, destinationHost)).limit(1);
    if (local) return false;
    // Reserve before calling the provider. A retry after an uncertain provider
    // result must not forward a second copy. The local original is always kept.
    const contentDigest = await crypto.subtle.digest("SHA-256", raw);
    const contentKey = Array.from(new Uint8Array(contentDigest), byte => byte.toString(16).padStart(2, "0")).join("");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([recipient, rule.destination, contentKey])));
    const attemptId = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    const db = getDb(env);
    try {
      await db.insert(typewitForwardingAttempts).values({ id: attemptId, mailboxId: rule.mailboxId, state: "pending" });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const [attempt] = await db.select({ state: typewitForwardingAttempts.state }).from(typewitForwardingAttempts).where(eq(typewitForwardingAttempts.id, attemptId)).limit(1);
      console.info(JSON.stringify({ event: "typewit.forward.duplicate_suppressed", mailboxId: rule.mailboxId }));
      return attempt?.state === "delivered";
    }
    const headers = new Headers({ [TYPEWIT_FORWARD_HEADER]: "1", "X-Mailflare-Forwarded": "1" });
    try {
      await message.forward(rule.destination, headers);
      await db.update(typewitForwardingAttempts).set({ state: "delivered" }).where(eq(typewitForwardingAttempts.id, attemptId));
      console.info(JSON.stringify({ event: "typewit.forward.delivered", mailboxId: rule.mailboxId }));
      return true;
    } catch {
      await db.update(typewitForwardingAttempts).set({ state: "failed" }).where(eq(typewitForwardingAttempts.id, attemptId)).catch(() => undefined);
      console.error(JSON.stringify({ event: "typewit.forward.failed", mailboxId: rule.mailboxId, localCopy: true }));
      return false;
    }
  } catch {
    console.error(JSON.stringify({ event: "typewit.forward.unavailable", localCopy: true }));
    return false;
  }
}
