import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { domains, mailboxes, typewitForwarding } from "@/db/schema";
import { getEnv } from "@/lib/cloudflare";
import { createAuditLog } from "@/lib/mailboxes/audit";
import { requireTypewitAdmin, typewitMutation, typewitError, TypewitHttpError } from "@/lib/typewit/http";
import { forwardingSchema, verifiedForwardDestination } from "@/lib/typewit/forwarding";

export async function GET(request: Request) {
  const env = getEnv();
  let viewer;
  try { viewer = await requireTypewitAdmin(env, request); }
  catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  try {
    const db = getDb(env);
    const rules = await db.select().from(typewitForwarding).limit(100);
    const sources = await db.select({ id: mailboxes.id, localPart: mailboxes.localPart, hostname: domains.hostname }).from(mailboxes)
      .innerJoin(domains, eq(mailboxes.domainId, domains.id)).where(and(eq(domains.userId, viewer.id), eq(domains.receivingProvider, "cloudflare"))).limit(100);
    return NextResponse.json({ rules, sources, available: env.TYPEWIT_FORWARDING_ENABLED === "true" && env.TYPEWIT_STAGING !== "true" }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return typewitError(error); }
}

export async function PUT(request: Request) {
  const env = getEnv();
  let viewer;
  try { viewer = await requireTypewitAdmin(env, request); }
  catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  try {
    const input = await typewitMutation(request, forwardingSchema);
    const db = getDb(env);
    const [mailbox] = await db.select({ id: mailboxes.id }).from(mailboxes)
      .innerJoin(domains, eq(mailboxes.domainId, domains.id))
      .where(and(eq(mailboxes.id, input.mailboxId), eq(domains.userId, viewer.id), eq(domains.receivingProvider, "cloudflare"))).limit(1);
    if (!mailbox) throw new TypewitHttpError(404, "Cloudflare mailbox not found");
    if (!input.enabled) {
      await db.update(typewitForwarding).set({ enabled: false, updatedAt: new Date() }).where(eq(typewitForwarding.mailboxId, mailbox.id));
    } else {
      if (env.TYPEWIT_STAGING === "true" || env.TYPEWIT_FORWARDING_ENABLED !== "true") throw new TypewitHttpError(503, "Forwarding is disabled pending isolated delivery validation");
      const host = input.destination.slice(input.destination.lastIndexOf("@") + 1);
      const [local] = await db.select({ id: domains.id }).from(domains).where(eq(domains.hostname, host)).limit(1);
      if (local) throw new TypewitHttpError(400, "Forwarding to a local domain is prohibited to prevent loops");
      if (!(await verifiedForwardDestination(env, input.destination))) throw new TypewitHttpError(400, "Verify the destination in this Cloudflare account before enabling forwarding");
      const values = { mailboxId: mailbox.id, destination: input.destination, enabled: true, verifiedAt: new Date(), updatedAt: new Date() };
      await db.insert(typewitForwarding).values(values).onConflictDoUpdate({ target: typewitForwarding.mailboxId, set: values });
    }
    await createAuditLog(env, { actorUserId: viewer.id, mailboxId: mailbox.id, action: input.enabled ? "typewit.forward.enabled" : "typewit.forward.disabled" });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return typewitError(error); }
}
