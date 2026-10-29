import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getEmailAddress } from "@/lib/email/address";
import { resolveInboundAddress } from "@/lib/email/routing";

export const MAILFLARE_FORWARDED_HEADER = "X-Mailflare-Forwarded";

export async function getAccountForwardingDestination(
	env: CloudflareEnv,
	recipient: string,
): Promise<string | null> {
	const db = getDb(env);
	const decision = await resolveInboundAddress(db, recipient);
	if (!decision?.mailbox) return null;
	const [account] = await db
		.select({ forwardingEmail: users.forwardingEmail, disabled: users.disabled, deletedAt: users.deletedAt })
		.from(users)
		.where(eq(users.id, decision.mailbox.userId))
		.limit(1);
	if (!account || account.disabled || account.deletedAt) return null;
	const destination = account.forwardingEmail?.trim() ?? "";
	if (!destination || getEmailAddress(destination).toLowerCase() === getEmailAddress(recipient).toLowerCase()) {
		return null;
	}
	return destination;
}
