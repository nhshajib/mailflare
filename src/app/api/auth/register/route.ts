import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Public registration is disabled. Contact your administrator for an account." },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}
