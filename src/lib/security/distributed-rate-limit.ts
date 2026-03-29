import { opLog } from "@/lib/op-logger";
import { getRateLimitStore } from "@/lib/security/rate-limit-store";
import { RateLimitStoreUnavailableError } from "@/lib/security/rate-limit-store/types";

export type RateLimitFailureMode = "fail-open" | "fail-closed";

export type DistributedRateLimitPolicy = {
  cooldownMs: number;
  windowMs: number;
  maxInWindow: number;
  blockDurationMs: number;
};

type RateLimitMessages = {
  cooldown: string;
  blocked: string;
  unavailable: string;
};

export class DistributedRateLimitError extends Error {
  readonly code: "COOLDOWN" | "BLOCKED" | "STORE_UNAVAILABLE";
  readonly retryAfterSeconds: number | null;

  constructor(params: {
    code: DistributedRateLimitError["code"];
    message: string;
    retryAfterSeconds?: number | null;
  }) {
    super(params.message);
    this.name = "DistributedRateLimitError";
    this.code = params.code;
    this.retryAfterSeconds = params.retryAfterSeconds ?? null;
  }
}

function toRetryAfterSeconds(untilMs: number, nowMs: number): number {
  return Math.max(Math.ceil((untilMs - nowMs) / 1000), 1);
}

function formatCooldownMessage(template: string, retryAfterSeconds: number) {
  if (template.includes("{retryAfter}")) {
    return template.replace(/\{retryAfter\}/g, String(retryAfterSeconds));
  }
  // Özel metin (ör. ödeme) korunur; kalan süre eklenir.
  return `${template} (${retryAfterSeconds} sn)`;
}

async function enforceSingleKey(params: {
  key: string;
  policy: DistributedRateLimitPolicy;
  messages: RateLimitMessages;
}) {
  const { key, policy, messages } = params;
  const nowMs = Date.now();
  const store = getRateLimitStore();

  const blockedUntil = await store.getBlock(key);
  if (blockedUntil && nowMs < blockedUntil) {
    throw new DistributedRateLimitError({
      code: "BLOCKED",
      message: messages.blocked,
      retryAfterSeconds: toRetryAfterSeconds(blockedUntil, nowMs),
    });
  }

  const safeWindowMs = Math.max(1, policy.windowMs || policy.cooldownMs || 1000);
  const cooldownUntil = await store.getCooldown(key);

  if (policy.cooldownMs > 0 && cooldownUntil && nowMs < cooldownUntil) {
    const attempts = await store.increment(key, safeWindowMs);
    if (
      policy.maxInWindow > 0 &&
      policy.blockDurationMs > 0 &&
      attempts > policy.maxInWindow
    ) {
      const nextBlockUntil = nowMs + policy.blockDurationMs;
      await store.setBlock(key, nextBlockUntil);
      throw new DistributedRateLimitError({
        code: "BLOCKED",
        message: messages.blocked,
        retryAfterSeconds: toRetryAfterSeconds(nextBlockUntil, nowMs),
      });
    }

    const retryAfter = toRetryAfterSeconds(cooldownUntil, nowMs);
    throw new DistributedRateLimitError({
      code: "COOLDOWN",
      message: formatCooldownMessage(messages.cooldown, retryAfter),
      retryAfterSeconds: retryAfter,
    });
  }

  const attempts = await store.increment(key, safeWindowMs);

  if (policy.cooldownMs > 0) {
    await store.touchCooldown(key, nowMs + policy.cooldownMs);
  }

  if (
    policy.maxInWindow > 0 &&
    policy.blockDurationMs > 0 &&
    attempts > policy.maxInWindow
  ) {
    const nextBlockUntil = nowMs + policy.blockDurationMs;
    await store.setBlock(key, nextBlockUntil);
    throw new DistributedRateLimitError({
      code: "BLOCKED",
      message: messages.blocked,
      retryAfterSeconds: toRetryAfterSeconds(nextBlockUntil, nowMs),
    });
  }
}

function isStoreUnavailableError(error: unknown): boolean {
  return error instanceof RateLimitStoreUnavailableError;
}

/**
 * Tek anahtar + atomik cooldown (Redis PTTL / bellekte senkron kontrol).
 * increment/window ile cooldown aynı anahtarda yarışmaz; retryAfter PTTL ile uyumludur.
 */
export async function assertDistributedAtomicCooldown(params: {
  key: string;
  cooldownMs: number;
  messages: RateLimitMessages;
  action: string;
  failureMode: RateLimitFailureMode;
  tenantId?: number;
  tableId?: number;
}) {
  const {
    key,
    cooldownMs,
    messages,
    action,
    failureMode,
    tenantId,
    tableId,
  } = params;
  const store = getRateLimitStore();

  try {
    const result = await store.tryAcquireCooldown(key, cooldownMs);
    if (result.ok) {
      return;
    }

    const error = new DistributedRateLimitError({
      code: "COOLDOWN",
      message: formatCooldownMessage(messages.cooldown, result.retryAfterSeconds),
      retryAfterSeconds: result.retryAfterSeconds,
    });
    opLog({
      tenantId,
      tableId,
      action: `${action}_RATE_LIMITED`,
      result: "error",
      message: `code=${error.code}; retryAfter=${error.retryAfterSeconds ?? "n/a"}`,
    });
    throw error;
  } catch (error) {
    if (error instanceof DistributedRateLimitError) {
      throw error;
    }

    if (isStoreUnavailableError(error)) {
      opLog({
        tenantId,
        tableId,
        action: `${action}_RATE_LIMIT_STORE_UNAVAILABLE`,
        result: "error",
      });

      if (failureMode === "fail-open") {
        console.warn(`[security] ${action} rate limit store unavailable, fail-open applied.`);
        return;
      }

      throw new DistributedRateLimitError({
        code: "STORE_UNAVAILABLE",
        message: messages.unavailable,
        retryAfterSeconds: null,
      });
    }

    throw error;
  }
}

export async function assertDistributedRateLimit(params: {
  keys: string[];
  policy: DistributedRateLimitPolicy;
  messages: RateLimitMessages;
  action: string;
  failureMode: RateLimitFailureMode;
  tenantId?: number;
  tableId?: number;
  orderId?: number;
  billRequestId?: number;
}) {
  const {
    keys,
    policy,
    messages,
    action,
    failureMode,
    tenantId,
    tableId,
    orderId,
    billRequestId,
  } = params;

  for (const key of keys) {
    try {
      await enforceSingleKey({
        key,
        policy,
        messages,
      });
    } catch (error) {
      if (error instanceof DistributedRateLimitError) {
        opLog({
          tenantId,
          tableId,
          orderId,
          billRequestId,
          action: `${action}_RATE_LIMITED`,
          result: "error",
          message: `code=${error.code}; retryAfter=${error.retryAfterSeconds ?? "n/a"}`,
        });
        throw error;
      }

      if (isStoreUnavailableError(error)) {
        opLog({
          tenantId,
          tableId,
          orderId,
          billRequestId,
          action: `${action}_RATE_LIMIT_STORE_UNAVAILABLE`,
          result: "error",
        });

        if (failureMode === "fail-open") {
          console.warn(`[security] ${action} rate limit store unavailable, fail-open applied.`);
          return;
        }

        throw new DistributedRateLimitError({
          code: "STORE_UNAVAILABLE",
          message: messages.unavailable,
          retryAfterSeconds: null,
        });
      }

      throw error;
    }
  }
}
