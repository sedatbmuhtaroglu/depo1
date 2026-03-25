import { createHash, randomBytes } from "node:crypto";
import type { ContentPreviewTargetType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const DEFAULT_PREVIEW_TTL_HOURS = 72;

function getPreviewTokenSecret(): string {
  const secret = process.env.PREVIEW_TOKEN_SECRET?.trim();
  if (secret && secret.length > 0) return secret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("PREVIEW_TOKEN_SECRET must be configured in production.");
  }

  return "menucy-dev-preview-token-secret";
}

function hashPreviewToken(token: string): string {
  return createHash("sha256").update(`${token}:${getPreviewTokenSecret()}`).digest("hex");
}

function resolvePreviewTtlHours(): number {
  const raw = Number.parseInt(process.env.PREVIEW_TOKEN_TTL_HOURS ?? "", 10);
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_PREVIEW_TTL_HOURS;
  return Math.min(24 * 30, raw);
}

export async function createPreviewToken(params: {
  targetType: ContentPreviewTargetType;
  targetId: number;
  createdBy?: string | null;
}) {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashPreviewToken(rawToken);
  const expiresAt = new Date(Date.now() + resolvePreviewTtlHours() * 60 * 60 * 1000);

  await prisma.contentPreviewToken.create({
    data: {
      targetType: params.targetType,
      targetId: params.targetId,
      tokenHash,
      expiresAt,
      createdBy: params.createdBy ?? null,
    },
  });

  return {
    token: rawToken,
    expiresAt,
  };
}

export async function validatePreviewToken(params: {
  targetType: ContentPreviewTargetType;
  targetId: number;
  token: string;
}): Promise<boolean> {
  const token = params.token.trim();
  if (!token) return false;

  const tokenHash = hashPreviewToken(token);
  const now = new Date();

  const row = await prisma.contentPreviewToken.findFirst({
    where: {
      targetType: params.targetType,
      targetId: params.targetId,
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: now },
    },
    select: { id: true },
  });

  return Boolean(row);
}

export function appendPreviewTokenToPath(pathname: string, token: string): string {
  const safePath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const joiner = safePath.includes("?") ? "&" : "?";
  return `${safePath}${joiner}preview=${encodeURIComponent(token)}`;
}
