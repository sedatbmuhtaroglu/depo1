import { headers } from "next/headers";
import { SECURITY_RATE_LIMITS } from "@/lib/security/config";
import { getPrivilegedSessionForTenant } from "@/lib/auth";
import { hashValue } from "@/lib/security/hash";
import {
  assertDistributedAtomicCooldown,
  assertDistributedRateLimit,
  DistributedRateLimitError,
  type DistributedRateLimitPolicy,
  type RateLimitFailureMode,
} from "@/lib/security/distributed-rate-limit";

type TableActionType =
  | "CREATE_ORDER"
  | "WAITER_CALL"
  | "REQUEST_BILL"
  | "REQUEST_BILL_WITH_METHOD"
  | "TABLE_QR_ENTRY"
  | "ORDER_CANCEL"
  | "CART_SUBMIT"
  | (string & {});

type RateLimitConfig = {
  cooldownMs: number;
  windowMs?: number;
  maxInWindow?: number;
  blockDurationMs?: number;
};

const DEFAULT_MESSAGE =
  "Cok sik islem yapiliyor. Lutfen kisa sure sonra tekrar deneyin.";
const TEMP_BLOCK_MESSAGE =
  "Bu masa icin gecici guvenlik kisiti uygulandi. Lutfen garsona basvurun.";
/** {retryAfter} kalan saniye ile doldurulur (distributed-rate-limit). */
const COOLDOWN_MESSAGE =
  "Çok kısa sürede tekrar denendi. Lütfen {retryAfter} saniye bekleyin.";
const STORE_UNAVAILABLE_MESSAGE =
  "Guvenlik kontrolu gecici olarak kullanilamiyor. Lutfen biraz sonra tekrar deneyin.";

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

export type RateLimitInfo = {
  code: "COOLDOWN" | "BLOCKED" | "STORE_UNAVAILABLE";
  retryAfterSeconds: number | null;
};

export class RateLimitError extends Error {
  readonly code: RateLimitInfo["code"];
  readonly retryAfterSeconds: number | null;

  constructor(
    message: string = DEFAULT_MESSAGE,
    options?: { code?: RateLimitInfo["code"]; retryAfterSeconds?: number | null },
  ) {
    super(message);
    this.name = "RateLimitError";
    this.code = options?.code ?? "COOLDOWN";
    this.retryAfterSeconds =
      options?.retryAfterSeconds !== undefined ? options.retryAfterSeconds : null;
  }
}

export async function shouldBypassRateLimit(options: {
  tenantId: number;
  allowPrivilegedBypass?: boolean;
}) {
  if (!options.allowPrivilegedBypass) return false;
  const privilegedSession = await getPrivilegedSessionForTenant(options.tenantId);
  return Boolean(privilegedSession);
}

async function buildKeys(options: {
  tenantId: number;
  tableId: number;
  action: TableActionType;
  fingerprintHash?: string | null;
  ipOverride?: string | null;
  sessionScope?: string | number | null;
}) {
  const {
    tenantId,
    tableId,
    action,
    fingerprintHash,
    ipOverride,
    sessionScope,
  } = options;

  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for") || h.get("x-real-ip") || "";
  const detectedIp = forwardedFor.split(",")[0]?.trim() || "unknown";
  const ipRaw = ipOverride?.trim() || detectedIp;
  const ipHash = hashValue(ipRaw) ?? "unknown";

  const baseKey = [
    "table-action",
    `tenant:${normalizeKeyPart(tenantId)}`,
    `table:${normalizeKeyPart(tableId)}`,
    `action:${normalizeKeyPart(action)}`,
  ].join(":");

  const normalizedSessionScope =
    sessionScope == null ? null : normalizeKeyPart(String(sessionScope));

  const sessionScopedKey = normalizedSessionScope
    ? `${baseKey}:session:${normalizedSessionScope}`
    : null;

  const ipScopeBase = sessionScopedKey ?? baseKey;
  const sessionAndIpKey = `${ipScopeBase}:ip:${ipHash}`;

  const normalizedFingerprintHash = fingerprintHash?.trim().toLowerCase() || null;
  const sessionAndIpAndFingerprintKey = normalizedFingerprintHash
    ? `${sessionAndIpKey}:fp:${normalizeKeyPart(normalizedFingerprintHash)}`
    : null;

  const keysToCheck = [baseKey];
  if (sessionScopedKey) {
    keysToCheck.push(sessionScopedKey);
  }
  keysToCheck.push(sessionAndIpKey);
  if (sessionAndIpAndFingerprintKey) {
    keysToCheck.push(sessionAndIpAndFingerprintKey);
  }

  return keysToCheck;
}

/** Atomik QR giriş limiti: eski table-action:* anahtarlarından ayrı (increment/cooldown yarışı yok). */
export async function buildTableQrEntryKey(options: {
  tenantId: number;
  tableId: number;
  ipOverride?: string | null;
}) {
  const { tenantId, tableId, ipOverride } = options;
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for") || h.get("x-real-ip") || "";
  const detectedIp = forwardedFor.split(",")[0]?.trim() || "unknown";
  const ipRaw = ipOverride?.trim() || detectedIp;
  const ipHash = hashValue(ipRaw) ?? "unknown";

  return [
    "table-qr-entry",
    `tenant:${normalizeKeyPart(tenantId)}`,
    `table:${normalizeKeyPart(tableId)}`,
    `ip:${ipHash}`,
  ].join(":");
}

async function assertTableQrEntryAllowed(options: {
  tenantId: number;
  tableId: number;
  config: RateLimitConfig;
  ipOverride?: string | null;
  storeFailureMode?: RateLimitFailureMode;
}) {
  const { tenantId, tableId, config, ipOverride, storeFailureMode = "fail-closed" } =
    options;
  const cooldownMs = Math.max(0, config.cooldownMs);
  if (cooldownMs <= 0) {
    return;
  }

  const key = await buildTableQrEntryKey({ tenantId, tableId, ipOverride });

  try {
    await assertDistributedAtomicCooldown({
      key,
      cooldownMs,
      messages: {
        cooldown: COOLDOWN_MESSAGE,
        blocked: TEMP_BLOCK_MESSAGE,
        unavailable: STORE_UNAVAILABLE_MESSAGE,
      },
      action: `TABLE_${normalizeKeyPart("TABLE_QR_ENTRY")}`,
      failureMode: storeFailureMode,
      tenantId,
      tableId,
    });
  } catch (error) {
    if (error instanceof DistributedRateLimitError) {
      throw new RateLimitError(error.message, {
        code: error.code,
        retryAfterSeconds: error.retryAfterSeconds,
      });
    }
    throw error;
  }
}

async function assertInMemoryOrDistributedAllowed(options: {
  tenantId: number;
  tableId: number;
  action: TableActionType;
  config: RateLimitConfig;
  fingerprintHash?: string | null;
  ipOverride?: string | null;
  sessionScope?: string | number | null;
  storeFailureMode?: RateLimitFailureMode;
}) {
  const {
    tenantId,
    tableId,
    action,
    config,
    fingerprintHash,
    ipOverride,
    sessionScope,
    storeFailureMode = "fail-closed",
  } = options;

  const keysToCheck = await buildKeys({
    tenantId,
    tableId,
    action,
    fingerprintHash,
    ipOverride,
    sessionScope,
  });

  const policy: DistributedRateLimitPolicy = {
    cooldownMs: Math.max(0, config.cooldownMs),
    windowMs: Math.max(1, config.windowMs ?? config.cooldownMs ?? 1000),
    maxInWindow: Math.max(0, config.maxInWindow ?? 0),
    blockDurationMs: Math.max(0, config.blockDurationMs ?? 0),
  };

  try {
    await assertDistributedRateLimit({
      keys: keysToCheck,
      policy,
      messages: {
        cooldown: COOLDOWN_MESSAGE,
        blocked: TEMP_BLOCK_MESSAGE,
        unavailable: STORE_UNAVAILABLE_MESSAGE,
      },
      action: `TABLE_${normalizeKeyPart(action)}`,
      failureMode: storeFailureMode,
      tenantId,
      tableId,
    });
  } catch (error) {
    if (error instanceof DistributedRateLimitError) {
      throw new RateLimitError(error.message, {
        code: error.code,
        retryAfterSeconds: error.retryAfterSeconds,
      });
    }

    throw error;
  }
}

export async function assertTableSessionActionAllowed(options: {
  tenantId: number;
  tableId: number;
  action: TableActionType;
  config: RateLimitConfig;
  fingerprintHash?: string | null;
  ipOverride?: string | null;
  allowPrivilegedBypass?: boolean;
  sessionScope?: string | number | null;
  storeFailureMode?: RateLimitFailureMode;
}) {
  const {
    tenantId,
    tableId,
    action,
    config,
    fingerprintHash,
    ipOverride,
    allowPrivilegedBypass = false,
    sessionScope,
    storeFailureMode = "fail-closed",
  } = options;
  const { cooldownMs, windowMs, maxInWindow } = config;

  if (cooldownMs <= 0 && !windowMs && !maxInWindow) {
    return;
  }

  if (
    await shouldBypassRateLimit({
      tenantId,
      allowPrivilegedBypass,
    })
  ) {
    return;
  }

  if (action === "TABLE_QR_ENTRY") {
    await assertTableQrEntryAllowed({
      tenantId,
      tableId,
      config,
      ipOverride,
      storeFailureMode,
    });
    return;
  }

  await assertInMemoryOrDistributedAllowed({
    tenantId,
    tableId,
    action,
    config,
    fingerprintHash,
    ipOverride,
    sessionScope,
    storeFailureMode,
  });
}

export const TABLE_ACTION_COOLDOWNS: Record<TableActionType, RateLimitConfig> = {
  CREATE_ORDER: SECURITY_RATE_LIMITS.CREATE_ORDER,
  WAITER_CALL: SECURITY_RATE_LIMITS.WAITER_CALL,
  REQUEST_BILL: SECURITY_RATE_LIMITS.REQUEST_BILL,
  REQUEST_BILL_WITH_METHOD: SECURITY_RATE_LIMITS.REQUEST_BILL_WITH_METHOD,
  TABLE_QR_ENTRY: SECURITY_RATE_LIMITS.TABLE_QR_ENTRY,
  ORDER_CANCEL: SECURITY_RATE_LIMITS.ORDER_CANCEL,
  CART_SUBMIT: SECURITY_RATE_LIMITS.ORDER_CANCEL,
};
