import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { SECURITY_THRESHOLDS } from "@/lib/security/config";

export const TABLE_SESSION_COOKIE_NAME = "table_session";

const DEFAULT_SESSION_TTL_MINUTES = SECURITY_THRESHOLDS.sessionTtlMinutes;

export function generatePublicCode(length = 16): string {
  const bytes = crypto.randomBytes(length);
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < bytes.length; i++) {
    result += alphabet[bytes[i] % alphabet.length];
  }
  return result;
}

function generateSessionToken(length = 32): string {
  const bytes = crypto.randomBytes(length);
  return bytes.toString("base64url");
}

export async function resolveTableByPublicCode(publicCode: string) {
  if (!publicCode) return null;

  return prisma.table.findUnique({
    where: { publicCode },
    include: {
      restaurant: {
        include: {
          tenant: true,
        },
      },
    },
  });
}

export async function invalidateExpiredTableSessions() {
  const now = new Date();
  await prisma.tableSession.updateMany({
    where: {
      isActive: true,
      expiresAt: { lt: now },
    },
    data: {
      isActive: false,
    },
  });
}

export async function createTableSession(options: {
  tenantId: number;
  tableId: number;
  ttlMinutes?: number;
}) {
  const { tenantId, tableId, ttlMinutes = DEFAULT_SESSION_TTL_MINUTES } = options;

  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  // Eski aktif oturumlari pasife cek
  await prisma.tableSession.updateMany({
    where: {
      tenantId,
      tableId,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });

  const sessionToken = generateSessionToken();

  const session = await prisma.tableSession.create({
    data: {
      tenantId,
      tableId,
      sessionToken,
      isActive: true,
      expiresAt,
    },
  });

  return session;
}

export async function getValidTableSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(TABLE_SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return null;
  }

  const now = new Date();

  const session = await prisma.tableSession.findUnique({
    where: { sessionToken: token },
    include: {
      table: {
        include: {
          restaurant: {
            include: {
              tenant: true,
            },
          },
        },
      },
    },
  });

  if (!session || !session.isActive || session.expiresAt <= now) {
    return null;
  }

  const idleThreshold = new Date(
    now.getTime() - SECURITY_THRESHOLDS.sessionIdleTimeoutMinutes * 60 * 1000,
  );
  if (session.updatedAt < idleThreshold) {
    await prisma.tableSession.update({
      where: { id: session.id },
      data: { isActive: false },
    });
    return null;
  }

  if (!session.table.restaurant || !session.table.restaurant.tenant) {
    return null;
  }

  return session;
}

type RequireTableSessionOptions = {
  tableIdFromRequest?: string | number | null;
};

export class TableSessionError extends Error {
  code:
    | "NO_SESSION"
    | "INVALID_TABLE_ID"
    | "TABLE_MISMATCH"
    | "TENANT_MISMATCH";

  constructor(code: TableSessionError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

export async function requireValidTableSessionForRequest(
  options: RequireTableSessionOptions = {},
) {
  const session = await getValidTableSession();

  if (!session) {
    throw new TableSessionError(
      "NO_SESSION",
      "Masa oturumu bulunamadı veya süresi doldu.",
    );
  }

  const { tenantId: contextTenantId } = await getCurrentTenantOrThrow();

  if (session.tenantId !== contextTenantId) {
    throw new TableSessionError(
      "TENANT_MISMATCH",
      "Bu masa oturumu bu işletme için geçerli değil.",
    );
  }

  const { tableIdFromRequest } = options;

  if (tableIdFromRequest !== undefined && tableIdFromRequest !== null) {
    const requestTableId = Number(tableIdFromRequest);

    if (Number.isNaN(requestTableId)) {
      throw new TableSessionError(
        "INVALID_TABLE_ID",
        "Geçersiz masa numarası.",
      );
    }

    if (requestTableId !== session.tableId) {
      throw new TableSessionError(
        "TABLE_MISMATCH",
        "Bu masa oturumu bu masa için geçerli değil.",
      );
    }
  }

  return {
    session,
    tableId: session.tableId,
    tenantId: session.tenantId,
  };
}

