import { NextResponse } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { users, typewitAccounts } from "@/db/schema";
import { getEnv } from "@/lib/cloudflare";
import { deleteUserSessions } from "@/lib/auth/session";
import { createAuditLog } from "@/lib/mailboxes/audit";
import { requireTypewitAdmin, typewitMutation, typewitError, TypewitHttpError } from "@/lib/typewit/http";
import { createTypewitAccount, typewitCreateAccountSchema } from "./create";

export async function GET(request: Request) {
  const env = getEnv();
  try { await requireTypewitAdmin(env, request); }
  catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  try {
    const cursor = new URL(request.url).searchParams.get("after") ?? "";
    const rows = await getDb(env).select({
      id: users.id, email: users.email, name: users.name, role: users.role,
      disabled: users.disabled, isPrimaryAdmin: users.isPrimaryAdmin, provisioningState: typewitAccounts.state,
    }).from(users).leftJoin(typewitAccounts, eq(typewitAccounts.userId, users.id))
      .where(and(gt(users.id, cursor), isNull(users.deletedAt))).orderBy(users.id).limit(101);
    const accounts = rows.slice(0, 100);
    return NextResponse.json({ accounts, nextCursor: rows.length > 100 ? accounts.at(-1)?.id : null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return typewitError(error); }
}

export async function POST(request: Request) {
  const env = getEnv();
  let viewer;
  try { viewer = await requireTypewitAdmin(env, request); }
  catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  try {
    const input = await typewitMutation(request, typewitCreateAccountSchema);
    const response = await createTypewitAccount(env, viewer.id, input);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) { return typewitError(error); }
}

const updateSchema = z.object({ id: z.string().min(1).max(128), disabled: z.boolean() }).strict();
export async function PATCH(request: Request) {
  const env = getEnv();
  let viewer;
  try { viewer = await requireTypewitAdmin(env, request); }
  catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }
  try {
    const input = await typewitMutation(request, updateSchema);
    const db = getDb(env);
    // This independently owned endpoint manages only accounts it created.
    const [target] = await db.select({ id: users.id, role: users.role, isPrimaryAdmin: users.isPrimaryAdmin, state: typewitAccounts.state })
      .from(users).innerJoin(typewitAccounts, eq(typewitAccounts.userId, users.id))
      .where(and(eq(users.id, input.id), eq(users.createdByUserId, viewer.id), isNull(users.deletedAt))).limit(1);
    if (!target) throw new TypewitHttpError(404, "Managed account not found");
    if (target.role !== "user" || target.isPrimaryAdmin || target.id === viewer.id) throw new TypewitHttpError(403, "Administrator status cannot be changed here");
    if (target.state === "provisioning") throw new TypewitHttpError(409, "Account provisioning is still in progress");
    if (!input.disabled && target.state !== "ready") throw new TypewitHttpError(409, "Provisioning requires administrator review before activation");
    // Revoke before disabling; all session lookups also reject disabled accounts.
    if (input.disabled) await deleteUserSessions(env, target.id);
    await db.update(users).set({ disabled: input.disabled }).where(eq(users.id, target.id));
    await createAuditLog(env, { actorUserId: viewer.id, targetUserId: target.id, action: input.disabled ? "typewit.account.disabled" : "typewit.account.enabled" });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return typewitError(error); }
}
