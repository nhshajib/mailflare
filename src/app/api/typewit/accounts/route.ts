import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { assertPrimaryAdmin } from "@/lib/auth/admin";
import { requireUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";

/**
 * TypeWit-owned, read-only account directory.
 *
 * Intentionally separate from Mailflare's licensed account management API.
 * Account creation, updates and deletions are not exposed until the isolated
 * multi-user authorization and routing tests are complete.
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
