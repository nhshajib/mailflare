import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { domains, mailboxes, typewitForwarding, users } from "@/db/schema";
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
): Promise<boolean> {
  if (env.TYPEWIT_FORWARDING_ENABLED !== "true" || env.TYPEWIT_STAGING === "true") return false;
  if (message.headers.has(TYPEWIT_FORWARD_HEADER) || message.headers.has("X-Mailflare-Forwarded") || message.headers.has("Auto-Submitted")) return false;
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
    const headers = new Headers({ [TYPEWIT_FORWARD_HEADER]: "1", "X-Mailflare-Forwarded": "1" });
    try {
      await message.forward(rule.destination, headers);
      console.info(JSON.stringify({ event: "typewit.forward.delivered", mailboxId: rule.mailboxId }));
      return true;
    } catch {
      console.error(JSON.stringify({ event: "typewit.forward.failed", mailboxId: rule.mailboxId, localCopy: true }));
      return false;
    }
  } catch {
    console.error(JSON.stringify({ event: "typewit.forward.unavailable", localCopy: true }));
    return false;
  }
}
