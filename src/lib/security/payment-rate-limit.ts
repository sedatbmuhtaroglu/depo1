import { hashValue } from "@/lib/security/hash";
import {
  assertDistributedRateLimit,
  type RateLimitFailureMode,
} from "@/lib/security/distributed-rate-limit";

const CHECKOUT_CREATE_POLICY = {
  cooldownMs: 2_500,
  windowMs: 60_000,
  maxInWindow: 10,
  blockDurationMs: 5 * 60_000,
} as const;

const ORDER_CHECKOUT_INIT_POLICY = {
  cooldownMs: 2_000,
  windowMs: 60_000,
  maxInWindow: 8,
  blockDurationMs: 5 * 60_000,
} as const;

const CALLBACK_IP_POLICY = {
  cooldownMs: 100,
  windowMs: 60_000,
  maxInWindow: 240,
  blockDurationMs: 2 * 60_000,
} as const;

const CALLBACK_TOKEN_POLICY = {
  cooldownMs: 0,
  windowMs: 10 * 60_000,
  maxInWindow: 60,
  blockDurationMs: 10 * 60_000,
} as const;

const CALLBACK_MISSING_TOKEN_POLICY = {
  cooldownMs: 500,
  windowMs: 60_000,
  maxInWindow: 30,
  blockDurationMs: 5 * 60_000,
} as const;

function normalizeKeyPart(value: string | number): string {
  const normalized = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]/g, "_");
  if (!normalized) {
    return "unknown";
  }
  return normalized.slice(0, 80);
}

function hashPart(value: string | number | null | undefined): string {
  return hashValue(value == null ? null : String(value)) ?? "unknown";
}

export function resolveClientIpFromHeaders(headers: Headers): string {
  const forwardedFor = headers.get("x-forwarded-for") ?? "";
  const xRealIp = headers.get("x-real-ip") ?? "";
  const cfConnectingIp = headers.get("cf-connecting-ip") ?? "";

  const firstForwarded = forwardedFor.split(",")[0]?.trim();
  return firstForwarded || xRealIp.trim() || cfConnectingIp.trim() || "unknown";
}

export async function assertCheckoutCreateRateLimit(params: {
  tenantId: number;
  billRequestId: number;
  tableId: number;
  ipRaw: string;
}) {
  const { tenantId, billRequestId, tableId, ipRaw } = params;
  const ipHash = hashPart(ipRaw);

  await assertDistributedRateLimit({
    keys: [
      `checkout-create:tenant:${normalizeKeyPart(tenantId)}:ip:${ipHash}`,
      `checkout-create:tenant:${normalizeKeyPart(tenantId)}:bill:${normalizeKeyPart(billRequestId)}:ip:${ipHash}`,
      `checkout-create:tenant:${normalizeKeyPart(tenantId)}:table:${normalizeKeyPart(tableId)}:ip:${ipHash}`,
    ],
    policy: CHECKOUT_CREATE_POLICY,
    messages: {
      cooldown: "Kart odemesi cok sik deneniyor. Lutfen birkac saniye sonra tekrar deneyin.",
      blocked: "Kart odemesi gecici olarak kisitlandi. Lutfen biraz sonra tekrar deneyin.",
      unavailable:
        "Guvenlik kontrolu gecici olarak kullanilamiyor. Lutfen biraz sonra tekrar deneyin.",
    },
    action: "CHECKOUT_CREATE",
    failureMode: "fail-closed",
    tenantId,
    tableId,
    billRequestId,
  });
}

export async function assertOrderCheckoutInitRateLimit(params: {
  tenantId: number;
  orderId: number;
  tableId: number;
  ipRaw: string;
}) {
  const { tenantId, orderId, tableId, ipRaw } = params;
  const ipHash = hashPart(ipRaw);

  await assertDistributedRateLimit({
    keys: [
      `order-checkout-init:tenant:${normalizeKeyPart(tenantId)}:ip:${ipHash}`,
      `order-checkout-init:tenant:${normalizeKeyPart(tenantId)}:order:${normalizeKeyPart(orderId)}:ip:${ipHash}`,
      `order-checkout-init:tenant:${normalizeKeyPart(tenantId)}:table:${normalizeKeyPart(tableId)}:ip:${ipHash}`,
    ],
    policy: ORDER_CHECKOUT_INIT_POLICY,
    messages: {
      cooldown: "Odeme baslatma islemi cok sik deneniyor. Lutfen birkac saniye sonra tekrar deneyin.",
      blocked: "Odeme baslatma islemi gecici olarak kisitlandi. Lutfen biraz sonra tekrar deneyin.",
      unavailable:
        "Guvenlik kontrolu gecici olarak kullanilamiyor. Lutfen biraz sonra tekrar deneyin.",
    },
    action: "ORDER_CHECKOUT_INIT",
    failureMode: "fail-closed",
    tenantId,
    tableId,
    orderId,
  });
}

export async function assertPaymentCallbackAbuseGuard(params: {
  channel: "bill" | "order";
  token: string | null;
  ipRaw: string;
  failureMode?: RateLimitFailureMode;
}) {
  const { channel, token, ipRaw, failureMode = "fail-open" } = params;
  const normalizedChannel = normalizeKeyPart(channel);
  const ipHash = hashPart(ipRaw);

  await assertDistributedRateLimit({
    keys: [`payment-callback:${normalizedChannel}:ip:${ipHash}`],
    policy: CALLBACK_IP_POLICY,
    messages: {
      cooldown: "Callback request rate limit exceeded.",
      blocked: "Callback request blocked.",
      unavailable: "Callback rate limit unavailable.",
    },
    action: "PAYMENT_CALLBACK_IP_GUARD",
    failureMode,
  });

  if (!token) {
    await assertDistributedRateLimit({
      keys: [`payment-callback:${normalizedChannel}:missing-token:ip:${ipHash}`],
      policy: CALLBACK_MISSING_TOKEN_POLICY,
      messages: {
        cooldown: "Callback request rate limit exceeded.",
        blocked: "Callback request blocked.",
        unavailable: "Callback rate limit unavailable.",
      },
      action: "PAYMENT_CALLBACK_MISSING_TOKEN_GUARD",
      failureMode,
    });
    return;
  }

  await assertDistributedRateLimit({
    keys: [`payment-callback:${normalizedChannel}:token:${hashPart(token)}`],
    policy: CALLBACK_TOKEN_POLICY,
    messages: {
      cooldown: "Callback request rate limit exceeded.",
      blocked: "Callback request blocked.",
      unavailable: "Callback rate limit unavailable.",
    },
    action: "PAYMENT_CALLBACK_TOKEN_GUARD",
    failureMode,
  });
}
