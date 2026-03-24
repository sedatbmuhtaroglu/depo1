/**
 * Audit satırları için işlem yapan kişi etiketi (person-display-name ile tek standart).
 */

import { prisma } from "@/lib/prisma";
import {
  formatStaffDisplayName,
  normalizeDisplayWhitespace,
  resolvePersonDisplayName,
  type StaffNameFields,
} from "@/lib/person-display-name";

export type AuditLogActorFields = {
  actorType: string;
  actorId: string | null;
  role: string | null;
};

export type StaffProfileForAudit = StaffNameFields;

export type AuditStaffResolution = {
  byId: Map<number, StaffProfileForAudit>;
  byUsername: Map<string, StaffProfileForAudit>;
};

/** Known non-human admin actor ids stored in auditLog.actorId */
const SYSTEM_ADMIN_IDS = new Set(
  ["system", "gateway", "payment-callback", "payment_callback"].map((s) => s.toLowerCase()),
);

function isBareNumericId(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

function roleFallbackLabel(role: string | null | undefined, numericId: number): string {
  const r = role?.toUpperCase();
  if (r === "WAITER") return `Garson #${numericId}`;
  if (r === "MANAGER") return `Yönetici #${numericId}`;
  if (r === "KITCHEN") return `Mutfak #${numericId}`;
  if (Number.isFinite(numericId) && numericId > 0) return `Personel #${numericId}`;
  return "Bilinmeyen kullanıcı";
}

/**
 * Resolve display name for one audit row.
 * `resolution` maps staff by id (actorType staff) and by lowercase username (actorType admin → TenantStaff).
 */
export function formatAuditActorDisplayName(
  log: AuditLogActorFields,
  resolution: AuditStaffResolution | null | undefined,
): string {
  const actorType = (log.actorType ?? "").trim();
  const rawId = (log.actorId ?? "").trim();
  const role = log.role;

  if (!actorType) {
    return "Bilinmeyen kullanıcı";
  }

  if (actorType === "admin") {
    const idLower = rawId.toLowerCase();
    if (!rawId || SYSTEM_ADMIN_IDS.has(idLower)) {
      return "Sistem";
    }
    if (isBareNumericId(rawId)) {
      return `Panel #${Number(rawId)}`;
    }
    const staff = resolution?.byUsername.get(rawId.toLowerCase());
    if (staff) {
      const label = formatStaffDisplayName(staff);
      if (label) return label;
    }
    return normalizeDisplayWhitespace(rawId);
  }

  if (actorType === "staff") {
    const sid = Number(rawId);
    if (!rawId || !Number.isInteger(sid) || sid <= 0) {
      return "Bilinmeyen kullanıcı";
    }
    const staff = resolution?.byId.get(sid);
    if (staff) {
      const label = formatStaffDisplayName(staff);
      if (label) return label;
    }
    return roleFallbackLabel(role, sid);
  }

  if (rawId && !isBareNumericId(rawId)) {
    return resolvePersonDisplayName({ name: rawId }) || normalizeDisplayWhitespace(rawId);
  }

  return "Bilinmeyen kullanıcı";
}

export async function loadStaffProfilesForAuditLogs(
  tenantId: number,
  logs: AuditLogActorFields[],
): Promise<AuditStaffResolution> {
  const ids = new Set<number>();
  const usernames = new Set<string>();

  for (const log of logs) {
    const t = (log.actorType ?? "").trim();
    const raw = (log.actorId ?? "").trim();
    if (!raw) continue;

    if (t === "staff" && isBareNumericId(raw)) {
      const sid = Number(raw);
      if (Number.isInteger(sid) && sid > 0) ids.add(sid);
      continue;
    }

    if (t === "admin") {
      const idLower = raw.toLowerCase();
      if (SYSTEM_ADMIN_IDS.has(idLower) || isBareNumericId(raw)) continue;
      usernames.add(raw.toLowerCase());
    }
  }

  const orConditions: Array<{ id: { in: number[] } } | { username: { in: string[] } }> = [];
  if (ids.size > 0) orConditions.push({ id: { in: [...ids] } });
  if (usernames.size > 0) orConditions.push({ username: { in: [...usernames] } });

  if (orConditions.length === 0) {
    return { byId: new Map(), byUsername: new Map() };
  }

  const rows = await prisma.tenantStaff.findMany({
    where: {
      tenantId,
      OR: orConditions,
    },
    select: { id: true, displayName: true, username: true },
  });

  const byId = new Map<number, StaffProfileForAudit>();
  const byUsername = new Map<string, StaffProfileForAudit>();
  for (const r of rows) {
    const profile: StaffProfileForAudit = {
      displayName: r.displayName,
      username: r.username,
    };
    byId.set(r.id, profile);
    byUsername.set(r.username.toLowerCase(), profile);
  }

  return { byId, byUsername };
}
