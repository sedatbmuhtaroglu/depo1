import { NextRequest, NextResponse } from "next/server";
import {
  TABLE_SESSION_COOKIE_NAME,
  createTableSession,
  getValidTableSession,
  invalidateExpiredTableSessions,
  resolveTableByPublicCode,
} from "@/lib/table-session";
import {
  TABLE_ACTION_COOLDOWNS,
  assertTableSessionActionAllowed,
  RateLimitError,
} from "@/lib/rate-limit";
import { evaluateAndLogRisk } from "@/lib/security/risk-engine";
import { buildTenantPublicUrl } from "@/lib/tenancy/public-url";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ publicCode: string }> },
) {
  const { publicCode } = await context.params;

  if (!publicCode) {
    return new NextResponse("Gecersiz masa kodu.", { status: 400 });
  }

  await invalidateExpiredTableSessions();

  const table = await resolveTableByPublicCode(publicCode);

  if (!table || !table.restaurant || !table.restaurant.tenant) {
    return new NextResponse("Masa bulunamadi.", { status: 404 });
  }

  if (!table.isActive) {
    return new NextResponse(
      "Bu masa şu an aktif değil. Lütfen garsona başvurun.",
      { status: 403 },
    );
  }

  const tenant = table.restaurant.tenant;
  const menuPath = `/menu/${encodeURIComponent(tenant.slug)}/${table.id}`;
  const menuUrl = await buildTenantPublicUrl({
    tenantId: tenant.id,
    pathname: menuPath,
    headers: request.headers,
  });

  const existingSession = await getValidTableSession();
  if (
    existingSession &&
    existingSession.tableId === table.id &&
    existingSession.tenantId === tenant.id
  ) {
    return NextResponse.redirect(menuUrl);
  }

  try {
    await assertTableSessionActionAllowed({
      tenantId: tenant.id,
      tableId: table.id,
      action: "TABLE_QR_ENTRY",
      config: TABLE_ACTION_COOLDOWNS.TABLE_QR_ENTRY,
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return new NextResponse(error.message, { status: 429 });
    }
    throw error;
  }

  const entryRisk = await evaluateAndLogRisk({
    tenantId: tenant.id,
    tableId: table.id,
    action: "TABLE_QR_ENTRY",
  });

  if (entryRisk.decision === "block") {
    return new NextResponse(
      "Guvenlik kontrolleri nedeniyle giris gecici olarak engellendi.",
      { status: 403 },
    );
  }

  const session = await createTableSession({
    tenantId: tenant.id,
    tableId: table.id,
  });

  const response = NextResponse.redirect(menuUrl);

  const maxAgeSeconds = Math.floor(
    (session.expiresAt.getTime() - Date.now()) / 1000,
  );

  response.cookies.set(TABLE_SESSION_COOKIE_NAME, session.sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSeconds > 0 ? maxAgeSeconds : undefined,
  });

  return response;
}
