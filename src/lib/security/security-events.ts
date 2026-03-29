import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type SecurityEventRange = "24h" | "7d";
export type SecurityEventRiskLevelFilter = "all" | "low" | "medium" | "high";

export type ListTenantSecurityEventsInput = {
  tenantId: number;
  range?: SecurityEventRange;
  riskLevel?: SecurityEventRiskLevelFilter;
  eventType?: string | null;
  cursor?: number | null;
  limit?: number;
};

export type SecurityEventListItem = {
  id: number;
  createdAt: Date;
  type: string;
  action: string;
  decision: string;
  riskLevel: "low" | "medium" | "high";
  riskScore: number;
  ipHash: string | null;
  tableId: number | null;
  tableNo: number | null;
  reasons: string[];
};

export type ListTenantSecurityEventsResult = {
  events: SecurityEventListItem[];
  eventTypes: string[];
  nextCursor: number | null;
};

const MAX_SECURITY_EVENTS_LIMIT = 50;

function resolveFromDate(range: SecurityEventRange): Date {
  const now = Date.now();
  if (range === "7d") {
    return new Date(now - 7 * 24 * 60 * 60 * 1000);
  }
  return new Date(now - 24 * 60 * 60 * 1000);
}

function parseReasons(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string");
}

function normalizeRiskLevel(raw: string | null): "low" | "medium" | "high" {
  const normalized = raw?.toLowerCase();
  if (normalized === "high" || normalized === "medium") return normalized;
  return "low";
}

export async function listTenantSecurityEvents(
  input: ListTenantSecurityEventsInput,
): Promise<ListTenantSecurityEventsResult> {
  const {
    tenantId,
    range = "24h",
    riskLevel = "all",
    eventType,
    cursor = null,
    limit = MAX_SECURITY_EVENTS_LIMIT,
  } = input;

  const take = Math.min(Math.max(1, limit), MAX_SECURITY_EVENTS_LIMIT);
  const fromDate = resolveFromDate(range);

  const where: Prisma.SecurityEventWhereInput = {
    tenantId,
    createdAt: { gte: fromDate },
  };

  if (riskLevel !== "all") {
    where.riskLevel = riskLevel;
  }

  if (eventType && eventType !== "all") {
    where.actionType = eventType;
  }

  const [events, eventTypesRaw] = await Promise.all([
    prisma.securityEvent.findMany({
      where,
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "desc" },
      include: {
        table: {
          select: { tableNo: true },
        },
      },
    }),
    prisma.securityEvent.findMany({
      where: { tenantId },
      select: { actionType: true },
      distinct: ["actionType"],
      orderBy: { actionType: "asc" },
    }),
  ]);

  const mappedEvents: SecurityEventListItem[] = events.map((event) => ({
    id: event.id,
    createdAt: event.createdAt,
    type: event.actionType,
    action: event.actionType,
    decision: event.outcome,
    riskLevel: normalizeRiskLevel(event.riskLevel),
    riskScore: event.riskScore,
    ipHash: event.ipHash,
    tableId: event.tableId,
    tableNo: event.table?.tableNo ?? null,
    reasons: parseReasons(event.reasons),
  }));

  return {
    events: mappedEvents,
    eventTypes: eventTypesRaw.map((row) => row.actionType),
    nextCursor: mappedEvents.length === take ? mappedEvents[mappedEvents.length - 1].id : null,
  };
}
