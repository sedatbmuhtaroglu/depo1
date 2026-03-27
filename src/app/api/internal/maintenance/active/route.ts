import { NextResponse } from "next/server";
import { getActivePlannedMaintenance } from "@/modules/content/server/content-queries";

export async function GET() {
  const active = await getActivePlannedMaintenance();
  return NextResponse.json(
    {
      active: Boolean(active),
      allowedPathPrefixes: active?.allowedPathPrefixes ?? [],
    },
    { status: 200 },
  );
}
