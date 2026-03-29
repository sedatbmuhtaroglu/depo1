import { createHash, randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { buildSafeAppUrl } from "@/lib/security/allowed-origins";
import { prisma } from "@/lib/prisma";

type PrismaClientLike = typeof prisma | Prisma.TransactionClient;

const TOKEN_BYTES = 32;
const DEFAULT_TOKEN_TTL_MINUTES = 60 * 24;
const MIN_TOKEN_TTL_MINUTES = 15;
const MAX_TOKEN_TTL_MINUTES = 60 * 24 * 14;

export type StaffSetPasswordTokenValidationCode =
  | "INVALID_TOKEN"
  | "TOKEN_NOT_FOUND"
  | "TOKEN_EXPIRED"
  | "TOKEN_ALREADY_USED"
  | "STAFF_INACTIVE"
  | "PASSWORD_ALREADY_INITIALIZED"
  | "OK";

export type StaffSetPasswordTokenSnapshot = {
  tokenId: number;
  tenantStaffId: number;
  username: string;
  displayName: string | null;
  role: "MANAGER" | "CASHIER" | "WAITER" | "KITCHEN";
  tenantId: number;
  tenantSlug: string;
  expiresAt: Date;
};

export type StaffSetPasswordTokenValidation =
  | {
      ok: true;
      code: "OK";
      snapshot: StaffSetPasswordTokenSnapshot;
    }
  | {
      ok: false;
      code: Exclude<StaffSetPasswordTokenValidationCode, "OK">;
    };

export class StaffSetPasswordTokenError extends Error {
  readonly code:
    | "STAFF_NOT_FOUND"
    | "STAFF_INACTIVE"
    | "PASSWORD_ALREADY_INITIALIZED"
    | "TOKEN_INVALID";

  constructor(
    code:
      | "STAFF_NOT_FOUND"
      | "STAFF_INACTIVE"
      | "PASSWORD_ALREADY_INITIALIZED"
      | "TOKEN_INVALID",
    message: string,
  ) {
    super(message);
    this.name = "StaffSetPasswordTokenError";
    this.code = code;
  }
}

type RawTokenRow = {
  id: number;
  tenantStaffId: number;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
  tenantStaff: {
    id: number;
    tenantId: number;
    username: string;
    displayName: string | null;
    role: "MANAGER" | "CASHIER" | "WAITER" | "KITCHEN";
    isActive: boolean;
    mustSetPassword: boolean;
    tenant: {
      slug: string;
    };
  };
};

function resolveTokenTtlMinutes(): number {
  const parsed = Number(process.env.STAFF_SET_PASSWORD_TOKEN_TTL_MINUTES ?? "");
  if (!Number.isFinite(parsed)) return DEFAULT_TOKEN_TTL_MINUTES;
  const rounded = Math.round(parsed);
  if (rounded < MIN_TOKEN_TTL_MINUTES || rounded > MAX_TOKEN_TTL_MINUTES) {
    return DEFAULT_TOKEN_TTL_MINUTES;
  }
  return rounded;
}

function normalizeIncomingToken(token: string): string {
  return token.trim();
}

export function hashSetPasswordToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

function generateSetPasswordTokenRaw(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

async function loadTokenByRawToken(
  rawToken: string,
  client: PrismaClientLike,
): Promise<RawTokenRow | null> {
  const normalized = normalizeIncomingToken(rawToken);
  if (!normalized || normalized.length < 20 || normalized.length > 200) {
    return null;
  }

  const tokenHash = hashSetPasswordToken(normalized);
  return client.staffSetPasswordToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      tenantStaffId: true,
      expiresAt: true,
      consumedAt: true,
      revokedAt: true,
      tenantStaff: {
        select: {
          id: true,
          tenantId: true,
          username: true,
          displayName: true,
          role: true,
          isActive: true,
          mustSetPassword: true,
          tenant: {
            select: {
              slug: true,
            },
          },
        },
      },
    },
  });
}

function mapTokenValidationResult(
  row: RawTokenRow | null,
  now: Date,
): StaffSetPasswordTokenValidation {
  if (!row) {
    return { ok: false, code: "TOKEN_NOT_FOUND" };
  }
  if (row.consumedAt || row.revokedAt) {
    return { ok: false, code: "TOKEN_ALREADY_USED" };
  }
  if (row.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, code: "TOKEN_EXPIRED" };
  }
  if (!row.tenantStaff.isActive) {
    return { ok: false, code: "STAFF_INACTIVE" };
  }
  if (!row.tenantStaff.mustSetPassword) {
    return { ok: false, code: "PASSWORD_ALREADY_INITIALIZED" };
  }

  return {
    ok: true,
    code: "OK",
    snapshot: {
      tokenId: row.id,
      tenantStaffId: row.tenantStaffId,
      tenantId: row.tenantStaff.tenantId,
      tenantSlug: row.tenantStaff.tenant.slug,
      username: row.tenantStaff.username,
      displayName: row.tenantStaff.displayName,
      role: row.tenantStaff.role,
      expiresAt: row.expiresAt,
    },
  };
}

export async function validateStaffSetPasswordToken(
  rawToken: string,
  client: PrismaClientLike = prisma,
): Promise<StaffSetPasswordTokenValidation> {
  const normalized = normalizeIncomingToken(rawToken);
  if (!normalized) {
    return { ok: false, code: "INVALID_TOKEN" };
  }
  const row = await loadTokenByRawToken(normalized, client);
  return mapTokenValidationResult(row, new Date());
}

export async function issueStaffSetPasswordToken(input: {
  tenantStaffId: number;
  createdBy?: string | null;
  client?: PrismaClientLike;
}) {
  const client = input.client ?? prisma;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + resolveTokenTtlMinutes() * 60_000);

  const staff = await client.tenantStaff.findUnique({
    where: { id: input.tenantStaffId },
    select: {
      id: true,
      isActive: true,
      mustSetPassword: true,
      username: true,
      displayName: true,
      role: true,
      tenant: {
        select: {
          id: true,
          slug: true,
        },
      },
    },
  });

  if (!staff) {
    throw new StaffSetPasswordTokenError("STAFF_NOT_FOUND", "Ilk yonetici hesabi bulunamadi.");
  }
  if (!staff.isActive) {
    throw new StaffSetPasswordTokenError("STAFF_INACTIVE", "Ilk yonetici hesabi aktif degil.");
  }
  if (!staff.mustSetPassword) {
    throw new StaffSetPasswordTokenError(
      "PASSWORD_ALREADY_INITIALIZED",
      "Bu hesap zaten sifre olusturmus.",
    );
  }

  await client.staffSetPasswordToken.updateMany({
    where: {
      tenantStaffId: staff.id,
      consumedAt: null,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    data: {
      revokedAt: now,
    },
  });

  const token = generateSetPasswordTokenRaw();
  const tokenHash = hashSetPasswordToken(token);
  await client.staffSetPasswordToken.create({
    data: {
      tenantStaffId: staff.id,
      tokenHash,
      expiresAt,
      createdBy: input.createdBy ?? null,
    },
  });

  return {
    token,
    expiresAt,
    tenantId: staff.tenant.id,
    tenantSlug: staff.tenant.slug,
    username: staff.username,
    displayName: staff.displayName,
    role: staff.role,
  };
}

export function buildStaffSetPasswordLink(input: {
  token: string;
  tenantSlug: string;
}) {
  const url = new URL(buildSafeAppUrl("/staff/set-password"));
  url.searchParams.set("token", input.token);
  url.searchParams.set("tenant", input.tenantSlug);
  return url.toString();
}

export async function consumeStaffSetPasswordToken(input: {
  rawToken: string;
  passwordHash: string;
}) {
  const normalized = normalizeIncomingToken(input.rawToken);
  if (!normalized) {
    return { ok: false as const, code: "INVALID_TOKEN" as const };
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const now = new Date();
        const row = await loadTokenByRawToken(normalized, tx);
        const validation = mapTokenValidationResult(row, now);
        if (!validation.ok) {
          return { ok: false as const, code: validation.code };
        }

        const consumed = await tx.staffSetPasswordToken.updateMany({
          where: {
            id: validation.snapshot.tokenId,
            consumedAt: null,
            revokedAt: null,
            expiresAt: { gt: now },
          },
          data: {
            consumedAt: now,
          },
        });

        if (consumed.count !== 1) {
          return { ok: false as const, code: "TOKEN_ALREADY_USED" as const };
        }

        await tx.staffSetPasswordToken.updateMany({
          where: {
            tenantStaffId: validation.snapshot.tenantStaffId,
            id: { not: validation.snapshot.tokenId },
            consumedAt: null,
            revokedAt: null,
          },
          data: {
            revokedAt: now,
          },
        });

        const updated = await tx.tenantStaff.updateMany({
          where: {
            id: validation.snapshot.tenantStaffId,
            isActive: true,
            mustSetPassword: true,
          },
          data: {
            passwordHash: input.passwordHash,
            mustSetPassword: false,
            passwordInitializedAt: now,
          },
        });

        if (updated.count !== 1) {
          throw new StaffSetPasswordTokenError(
            "TOKEN_INVALID",
            "Sifre kurulumu ayni anda baska bir islemle tamamlandi.",
          );
        }

        return {
          ok: true as const,
          snapshot: validation.snapshot,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof StaffSetPasswordTokenError) {
      return { ok: false as const, code: "TOKEN_ALREADY_USED" as const };
    }
    return { ok: false as const, code: "INVALID_TOKEN" as const };
  }
}

