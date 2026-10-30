import { NextResponse } from "next/server";
import { assertPrimaryAdmin } from "@/lib/auth/admin";
import { requireUser } from "@/lib/auth/cookies";
import { getEnv } from "@/lib/cloudflare";
import { checkLatestRelease } from "@/lib/updates/releases";
import packageMetadata from "../../../../../package.json";

export async function authorizeAdminRequest(request: Request) {
  const env = getEnv();
  let user: Awaited<ReturnType<typeof requireUser>>;

  try {
    user = await requireUser(env, request);
  } catch {
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  try {
    assertPrimaryAdmin(user);
  } catch {
    return {
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { env };
}

export async function getUpdateStatus() {
  return checkLatestRelease(packageMetadata.version);
}
