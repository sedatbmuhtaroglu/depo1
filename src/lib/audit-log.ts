import { prisma } from "@/lib/prisma";
import { logServerError } from "@/lib/server-error-log";

type Actor = { type: "admin"; id: string } | { type: "staff"; id: number; role: string };

export async function writeAuditLog(params: {
  tenantId: number;
  actor: Actor;
  actionType: string;
  entityType: string;
  entityId?: string | null;
  description?: string | null;
}) {
  const { tenantId, actor, actionType, entityType, entityId, description } = params;
  try {
    await prisma.auditLog.create({
      data: {
        tenantId,
        actorType: actor.type,
        actorId: actor.type === "admin" ? actor.id : String(actor.id),
        role: actor.type === "staff" ? actor.role : null,
        actionType,
        entityType,
        entityId: entityId ?? null,
        description: description ?? null,
      },
    });
  } catch (e) {
    logServerError("audit-log", e);
  }
}
