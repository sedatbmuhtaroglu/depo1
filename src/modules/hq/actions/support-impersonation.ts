"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHqAdminActor } from "@/core/authz/actors";
import { assertSurfaceGuard } from "@/core/surfaces/guard";
import { writeAuditLog } from "@/lib/audit-log";
import { requireHqSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generateSupportSessionToken,
  hashSupportToken,
  setSupportSessionCookie,
} from "@/lib/support-session";
import { assertPrivilegedServerActionOrigin } from "@/lib/server-action-guard";

export type StartSupportImpersonationResult =
  | { success: true }
  | { success: false; message: string };

const DURATIONS = new Set([15, 30, 60]);

const REASON_LABELS: Record<string, string> = {
  setup: "Kurulum / onboarding desteği",
  bug: "Hata / teknik inceleme",
  billing: "Fatura / plan sorusu",
  training: "Eğitim / kullanım",
  other: "Diğer",
};

function buildReason(preset: string, note: string | null): string {
  const label = REASON_LABELS[preset] ?? preset;
  if (preset === "other") {
    return note?.trim() ? `${label}: ${note.trim()}` : label;
  }
  if (note?.trim()) {
    return `${label} — ${note.trim()}`;
  }
  return label;
}

export async function startSupportImpersonationAction(
  formData: FormData,
): Promise<StartSupportImpersonationResult> {
  await assertPrivilegedServerActionOrigin();
  const hq = await requireHqSession();

  const tenantId = Number(formData.get("tenantId"));
  const preset = String(formData.get("reasonPreset") ?? "").trim();
  const noteRaw = formData.get("note");
  const note = typeof noteRaw === "string" ? noteRaw.trim() : "";
  const durationMinutes = Number(formData.get("durationMinutes"));

  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    return { success: false, message: "Geçersiz tenant." };
  }
  if (!REASON_LABELS[preset]) {
    return { success: false, message: "Geçersiz destek nedeni." };
  }
  if (preset === "other" && note.length < 3) {
    return { success: false, message: "Diğer seçildiğinde kısa bir not zorunludur." };
  }
  if (!DURATIONS.has(durationMinutes)) {
    return { success: false, message: "Geçersiz süre seçimi." };
  }

  await assertSurfaceGuard({
    surface: "hq-private",
    actor: createHqAdminActor(hq.username),
    operation: "mutation",
    tenantId,
    requiredCapability: "TENANT_STATUS_MANAGE",
  });

  const admin = await prisma.adminUser.findUnique({
    where: { username: hq.username },
    select: { id: true },
  });
  if (!admin) {
    return { success: false, message: "HQ hesabı bulunamadı." };
  }

  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, slug: true },
  });
  if (!tenant) {
    return { success: false, message: "Tenant bulunamadı." };
  }

  const restaurant = await prisma.restaurant.findFirst({
    where: { tenantId },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  const token = generateSupportSessionToken();
  const tokenHash = hashSupportToken(token);
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

  const reason = buildReason(preset, note || null);

  const sessionRow = await prisma.supportImpersonationSession.create({
    data: {
      tokenHash,
      hqAdminUserId: admin.id,
      tenantId,
      restaurantId: restaurant?.id ?? null,
      reason,
      note: note.length > 0 ? note.slice(0, 500) : null,
      durationMinutes,
      expiresAt,
    },
  });

  await setSupportSessionCookie({
    sessionId: sessionRow.id,
    token,
    tenantId,
    expiresAt,
  });

  const ts = new Date().toISOString();
  await writeAuditLog({
    tenantId,
    actor: { type: "admin", id: String(admin.id) },
    actionType: "support_session_started",
    entityType: "supportImpersonationSession",
    entityId: String(sessionRow.id),
    description: JSON.stringify({
      hqAdminUserId: admin.id,
      tenantId,
      supportSessionId: sessionRow.id,
      assumedRole: "MANAGER",
      reason,
      duration: durationMinutes,
      timestamp: ts,
    }),
  });

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  const target = new URL("/restaurant", `${proto}://${host}`);
  target.searchParams.set("tenant", tenant.slug);

  redirect(target.toString());
}
