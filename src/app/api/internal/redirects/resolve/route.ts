import { NextResponse } from "next/server";
import { resolveActiveRedirectRule } from "@/modules/content/server/redirect-rules";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path") ?? "";

  const resolved = await resolveActiveRedirectRule(path);
  if (!resolved) {
    return NextResponse.json({ matched: false }, { status: 200 });
  }

  return NextResponse.json(
    {
      matched: true,
      toPath: resolved.toPath,
      statusCode: resolved.statusCode,
      updatedAt: resolved.updatedAt.toISOString(),
    },
    { status: 200 },
  );
}
