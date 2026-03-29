import { createHmac, timingSafeEqual } from "node:crypto";
import { hashValue } from "@/lib/security/hash";

type OrderSuccessAccessPayload = {
  orderId: number;
  tenantId: number;
  paymentReferenceHash: string;
  issuedAtMs: number;
};

const DEFAULT_TTL_MS = 5 * 60_000;

function getOrderSuccessAccessSecret(): string {
  const explicitSecret = process.env.ORDER_SUCCESS_ACCESS_SECRET?.trim();
  if (explicitSecret && explicitSecret.length >= 16) return explicitSecret;

  const adminSessionSecret = process.env.ADMIN_SESSION_SECRET?.trim();
  if (adminSessionSecret && adminSessionSecret.length >= 16) return adminSessionSecret;

  if (process.env.NODE_ENV === "production") {
    throw new Error("ORDER_SUCCESS_ACCESS_SECRET or ADMIN_SESSION_SECRET must be set in production.");
  }

  return "order-success-access-local-secret-change-me";
}

function getOrderSuccessAccessTtlMs(): number {
  const raw = Number(process.env.ORDER_SUCCESS_ACCESS_TTL_SECONDS ?? "300");
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TTL_MS;
  return Math.floor(raw * 1000);
}

function sign(value: string): string {
  return createHmac("sha256", getOrderSuccessAccessSecret()).update(value).digest("hex");
}

export function createOrderSuccessAccessProof(input: {
  orderId: number;
  tenantId: number | null;
  paymentReference: string | null;
}): string | null {
  if (!Number.isInteger(input.orderId) || input.orderId <= 0) return null;
  const tenantId = input.tenantId;
  if (tenantId == null || !Number.isInteger(tenantId) || tenantId <= 0) return null;

  const paymentReferenceHash = hashValue(input.paymentReference);
  if (!paymentReferenceHash) return null;

  const payload: OrderSuccessAccessPayload = {
    orderId: input.orderId,
    tenantId,
    paymentReferenceHash,
    issuedAtMs: Date.now(),
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifyOrderSuccessAccessProof(input: {
  proof: string | null;
  orderId: number;
  tenantId: number | null;
  paymentReference: string | null;
}): boolean {
  if (!input.proof) return false;
  if (!Number.isInteger(input.orderId) || input.orderId <= 0) return false;
  if (!Number.isInteger(input.tenantId) || (input.tenantId ?? 0) <= 0) return false;

  const splitAt = input.proof.lastIndexOf(".");
  if (splitAt <= 0) return false;
  const encoded = input.proof.slice(0, splitAt);
  const signature = input.proof.slice(splitAt + 1);
  if (!encoded || !signature) return false;

  const expected = sign(encoded);
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  if (!timingSafeEqual(expectedBuf, providedBuf)) return false;

  let payload: OrderSuccessAccessPayload;
  try {
    payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as OrderSuccessAccessPayload;
  } catch {
    return false;
  }

  const paymentReferenceHash = hashValue(input.paymentReference);
  if (!paymentReferenceHash) return false;
  const ttlMs = getOrderSuccessAccessTtlMs();
  const now = Date.now();

  if (!Number.isInteger(payload.orderId) || payload.orderId !== input.orderId) return false;
  if (!Number.isInteger(payload.tenantId) || payload.tenantId !== input.tenantId) return false;
  if (payload.paymentReferenceHash !== paymentReferenceHash) return false;
  if (!Number.isFinite(payload.issuedAtMs) || payload.issuedAtMs <= 0) return false;
  if (now - payload.issuedAtMs > ttlMs) return false;

  return true;
}
