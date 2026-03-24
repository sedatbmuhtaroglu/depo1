import { NextResponse } from "next/server";
import { createStorefrontGuestActor } from "@/core/authz/actors";
import { assertSurfaceGuard } from "@/core/surfaces/guard";
import { runRequestWaiter } from "@/lib/waiter-request-core";
import type { ClientRiskSignals } from "@/lib/security/types";

export async function POST(request: Request) {
  try {
    await assertSurfaceGuard({
      surface: "storefront-public",
      actor: createStorefrontGuestActor(),
      operation: "mutation",
      requiredCapability: "REQUEST_WAITER",
    });
  } catch {
    return NextResponse.json(
      { success: false, message: "Surface access denied." },
      { status: 403 },
    );
  }

  let body: { tableId?: string; riskSignals?: ClientRiskSignals | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, message: "Invalid JSON body." }, { status: 400 });
  }

  const tableId = body.tableId;
  if (typeof tableId !== "string" || tableId.trim() === "") {
    return NextResponse.json({ success: false, message: "tableId required." }, { status: 400 });
  }

  try {
    const result = await runRequestWaiter(tableId, body.riskSignals ?? null);

    if (!result.success && result.rateLimit) {
      const headers = new Headers();
      if (result.rateLimit.retryAfterSeconds != null) {
        headers.set("Retry-After", String(result.rateLimit.retryAfterSeconds));
      }
      return NextResponse.json(result, { status: 429, headers });
    }

    return NextResponse.json(result, { status: 200 });
  } catch {
    return NextResponse.json(
      { success: false, message: "Garson cagirma istegi islenemedi." },
      { status: 500 },
    );
  }
}
