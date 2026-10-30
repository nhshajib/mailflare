import { NextResponse } from "next/server";
import { authorizeAdminRequest } from "./utils";

export async function POST(request: Request) {
  const authorization = await authorizeAdminRequest(request);
  if ("error" in authorization) return authorization.error;
  return NextResponse.json({ error: "Application updates are manual. Review upstream changes, merge them into your fork, and deploy." }, { status: 405, headers: { Allow: "GET" } });
}
