export type SecurityAction =
  | "AUTH_LOGIN"
  | "CREATE_ORDER"
  | "PAYMENT_INITIATE"
  | "BILL_SETTLEMENT"
  | "WAITER_CALL"
  | "REQUEST_BILL"
  | "REQUEST_BILL_WITH_METHOD"
  | "ORDER_CANCEL"
  | "TABLE_QR_ENTRY";

export type SecurityRateLimitConfig = {
  cooldownMs: number;
  windowMs: number;
  maxInWindow: number;
  blockDurationMs: number;
};

export type RateLimitStoreMode = "memory" | "redis";

function resolveRateLimitStoreMode(): RateLimitStoreMode {
  const raw = process.env.RATE_LIMIT_STORE?.trim().toLowerCase();
  if (raw === "redis") return "redis";
  return "memory";
}

function resolveRedisPrefix(): string {
  const raw = process.env.REDIS_PREFIX?.trim();
  if (!raw) return "qrmenu:ratelimit";
  return raw;
}

export const SECURITY_THRESHOLDS = {
  sessionTtlMinutes: 45,
  sessionIdleTimeoutMinutes: 20,
  riskLowMax: 39,
  riskMediumMax: 79,
  riskHighMin: 80,
  poorGpsAccuracyMeters: 250,
  geoJumpDistanceMeters: 5000,
  geoJumpWindowMs: 2 * 60_000,
  ipGpsMismatchMeters: 500_000,
  tableSwitchWindowMs: 10 * 60_000,
} as const;

export const SECURITY_RUNTIME_CONFIG = {
  rateLimitStoreMode: resolveRateLimitStoreMode(),
  redisPrefix: resolveRedisPrefix(),
} as const;

export const SECURITY_RATE_LIMITS: Record<SecurityAction, SecurityRateLimitConfig> = {
  AUTH_LOGIN: {
    cooldownMs: 5_000,
    windowMs: 60_000,
    maxInWindow: 5,
    blockDurationMs: 5 * 60_000,
  },
  CREATE_ORDER: {
    cooldownMs: 10_000,
    windowMs: 30_000,
    maxInWindow: 4,
    blockDurationMs: 2 * 60_000,
  },
  PAYMENT_INITIATE: {
    cooldownMs: 10_000,
    windowMs: 60_000,
    maxInWindow: 5,
    blockDurationMs: 3 * 60_000,
  },
  BILL_SETTLEMENT: {
    cooldownMs: 10_000,
    windowMs: 60_000,
    maxInWindow: 6,
    blockDurationMs: 3 * 60_000,
  },
  WAITER_CALL: {
    cooldownMs: 45_000,
    windowMs: 2 * 60_000,
    maxInWindow: 3,
    blockDurationMs: 3 * 60_000,
  },
  REQUEST_BILL: {
    cooldownMs: 45_000,
    windowMs: 2 * 60_000,
    maxInWindow: 3,
    blockDurationMs: 3 * 60_000,
  },
  REQUEST_BILL_WITH_METHOD: {
    cooldownMs: 45_000,
    windowMs: 2 * 60_000,
    maxInWindow: 3,
    blockDurationMs: 3 * 60_000,
  },
  ORDER_CANCEL: {
    cooldownMs: 15_000,
    windowMs: 60_000,
    maxInWindow: 6,
    blockDurationMs: 2 * 60_000,
  },
  TABLE_QR_ENTRY: {
    /** Atomik cooldown (tryAcquireCooldown); pencere/blok bu akışta kullanılmaz. */
    cooldownMs: 10_000,
    windowMs: 10_000,
    maxInWindow: 0,
    blockDurationMs: 0,
  },
};
