import { NextResponse } from "next/server";
import { assertPrimaryAdmin } from "@/lib/auth/admin";
import { requireUser } from "@/lib/auth/cookies";
import { readJsonBody } from "@/lib/http/request";
import { RequestBodyTooLargeError } from "@/lib/http/errors";
import type { z } from "zod";

export async function requireTypewitAdmin(env: CloudflareEnv, request: Request) {
  const user = await requireUser(env, request);
  assertPrimaryAdmin(user);
  return user;
}

export class TypewitHttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function typewitMutation<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  // Cookie and bearer mutations both require the exact browser origin.
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
    throw new TypewitHttpError(403, "Invalid origin");
  }
  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    throw new TypewitHttpError(415, "JSON request required");
  }
  let body: unknown;
  try { body = await readJsonBody(request, 16 * 1024); }
  catch (error) { throw new TypewitHttpError(error instanceof RequestBodyTooLargeError ? 413 : 400, "Invalid request body"); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new TypewitHttpError(400, "Invalid fields; check the form and try again");
  return parsed.data;
}

export function typewitError(error: unknown) {
  return NextResponse.json({ error: error instanceof TypewitHttpError ? error.message : "Operation unavailable" }, {
    status: error instanceof TypewitHttpError ? error.status : 500,
    headers: { "Cache-Control": "private, no-store" },
  });
}
