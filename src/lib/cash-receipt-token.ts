import { createHmac, timingSafeEqual } from "node:crypto";
import type { PaymentMethod } from "@prisma/client";

type ReceiptMethod = Extract<
  PaymentMethod,
  "CASH" | "CREDIT_CARD" | "SODEXO" | "MULTINET" | "TICKET" | "METROPOL"
>;

export type CashReceiptTokenPayload = {
  tenantId: number;
  receiptId: string;
  mode: "PARTIAL" | "FULL";
  restaurantName: string;
  tableNo: number;
  issuedAtIso: string;
  reference: string;
  cashierName: string;
  lines: Array<{
    method: ReceiptMethod;
    amount: number;
    note: string | null;
  }>;
  transactionTotal: number;
  remainingBefore: number;
  remainingAfter: number;
  disclaimer: string;
};

const RECEIPT_TOKEN_MAX_AGE_MS = 1000 * 60 * 60 * 24;

function getReceiptTokenSecret(): string {
  const fromEnv = process.env.CASH_RECEIPT_TOKEN_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 16) return fromEnv;
  if (process.env.NODE_ENV === "production") {
    throw new Error("CASH_RECEIPT_TOKEN_SECRET must be set in production.");
  }
  return "cash-receipt-local-secret-change-me";
}

function sign(value: string): string {
  return createHmac("sha256", getReceiptTokenSecret()).update(value).digest("hex");
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function createCashReceiptToken(payload: CashReceiptTokenPayload): string {
  const body = {
    ...payload,
    issuedAtMs: Date.now(),
  };
  const encodedBody = toBase64Url(JSON.stringify(body));
  const signature = sign(encodedBody);
  return `${encodedBody}.${signature}`;
}

export function verifyCashReceiptToken(token: string): CashReceiptTokenPayload | null {
  const splitAt = token.lastIndexOf(".");
  if (splitAt <= 0) return null;
  const encodedBody = token.slice(0, splitAt);
  const signature = token.slice(splitAt + 1);
  if (!encodedBody || !signature) return null;

  const expected = sign(encodedBody);
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== providedBuf.length) return null;
  if (!timingSafeEqual(expectedBuf, providedBuf)) return null;

  try {
    const decoded = JSON.parse(fromBase64Url(encodedBody)) as CashReceiptTokenPayload & {
      issuedAtMs?: number;
    };
    if (typeof decoded.issuedAtMs !== "number" || !Number.isFinite(decoded.issuedAtMs)) {
      return null;
    }
    if (Date.now() - decoded.issuedAtMs > RECEIPT_TOKEN_MAX_AGE_MS) {
      return null;
    }
    if (!Number.isInteger(decoded.tenantId) || decoded.tenantId <= 0) return null;
    if (!Number.isInteger(decoded.tableNo) || decoded.tableNo <= 0) return null;
    if (!decoded.receiptId || !decoded.reference || !decoded.cashierName) return null;
    if (!Array.isArray(decoded.lines) || decoded.lines.length === 0) return null;
    return {
      tenantId: decoded.tenantId,
      receiptId: decoded.receiptId,
      mode: decoded.mode,
      restaurantName: decoded.restaurantName,
      tableNo: decoded.tableNo,
      issuedAtIso: decoded.issuedAtIso,
      reference: decoded.reference,
      cashierName: decoded.cashierName,
      lines: decoded.lines,
      transactionTotal: decoded.transactionTotal,
      remainingBefore: decoded.remainingBefore,
      remainingAfter: decoded.remainingAfter,
      disclaimer: decoded.disclaimer,
    };
  } catch {
    return null;
  }
}
