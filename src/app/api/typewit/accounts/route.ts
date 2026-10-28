import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { assertPrimaryAdmin } from "@/lib/auth/admin";
import { requireUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";
import { createTypewitAccount, typewitCreateAccountSchema } from "./create";

/**
 * TypeWit-owned account directory and tightly-scoped personal account creation.
 *
 * Intentionally separate from Mailflare's licensed account management API.
 * Updates and deletions are deliberately not exposed.
 */
export async function GET(request: Request) {
  const env = getEnv();
  try {
    const viewer = await requireUser(env, request);
    assertPrimaryAdmin(viewer);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const rows = await getDb(env)
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        disabled: users.disabled,
        isPrimaryAdmin: users.isPrimaryAdmin,
      })
      .from(users)
      .limit(100);

    return NextResponse.json(
      { accounts: rows },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    return NextResponse.json({ error: "Unable to load account directory" }, { status: 500 });
  }
}

/**
 * Creates a normal user and one personal mailbox on an active, admin-owned
 * domain. Primary admin only. This endpoint is not yet deployed to production.
 */
export async function POST(request: Request) {
  const env = getEnv();
  try {
    const viewer = await requireUser(env, request);
    assertPrimaryAdmin(viewer);
    const origin = request.headers.get("origin");
    if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }
    if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
      return NextResponse.json({ error: "JSON request required" }, { status: 415 });
    }
    const parsed = typewitCreateAccountSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    try {
      return await createTypewitAccount(env, viewer.id, parsed.data);
    } catch {
      return NextResponse.json({ error: "Account provisioning unavailable" }, { status: 500 });
    }
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
