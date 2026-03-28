import { headers } from "next/headers";
import { opLog } from "@/lib/op-logger";
import { hashValue } from "@/lib/security/hash";
import { getRateLimitStore } from "@/lib/security/rate-limit-store";
import { RateLimitStoreUnavailableError } from "@/lib/security/rate-limit-store/types";

type LoginRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number; reason: "limited" | "infrastructure" };

const WINDOW_MS = 10 * 60 * 1000;
const INFRA_RETRY_SECONDS = 30;

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function hashPart(value: string): string {
  return hashValue(value) ?? "unknown";
}

function buildKey(params: { username: string; ip: string }) {
  const usernameHash = hashPart(normalizeUsername(params.username));
  const ipHash = hashPart(params.ip);
  return {
    ipKey: `admin-login:ip:${ipHash}`,
    userKey: `admin-login:user:${usernameHash}`,
    comboKey: `admin-login:user:${usernameHash}:ip:${ipHash}`,
    usernameHash,
    ipHash,
  };
}

function isStoreUnavailable(error: unknown): boolean {
  return error instanceof RateLimitStoreUnavailableError;
}

function toRetryAfterSeconds(untilMs: number, nowMs: number): number {
  return Math.max(Math.ceil((untilMs - nowMs) / 1000), 1);
}

function logStoreFailure(action: string) {
  opLog({
    action,
    result: "error",
  });
}

function resolveBlockDurationMs(attempts: number, mode: "ip" | "user" | "combo"): number | null {
  if (mode === "combo") {
    if (attempts >= 16) return 60 * 60 * 1000;
    if (attempts >= 12) return 30 * 60 * 1000;
    if (attempts >= 8) return 15 * 60 * 1000;
    if (attempts >= 5) return 3 * 60 * 1000;
    return null;
  }

  if (mode === "user") {
    if (attempts >= 14) return 60 * 60 * 1000;
    if (attempts >= 10) return 20 * 60 * 1000;
    if (attempts >= 6) return 5 * 60 * 1000;
    return null;
  }

  if (attempts >= 30) return 60 * 60 * 1000;
  if (attempts >= 20) return 20 * 60 * 1000;
  if (attempts >= 10) return 5 * 60 * 1000;
  return null;
}

export async function getAdminLoginClientIp() {
  const h = await headers();
  const forwardedFor = h.get("x-forwarded-for");
  if (forwardedFor) {
    const firstIp = forwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  return (
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    h.get("x-client-ip") ||
    "unknown"
  );
}

export async function checkAdminLoginRateLimit(params: {
  username: string;
  ip: string;
}): Promise<LoginRateLimitResult> {
  const keys = buildKey(params);

  try {
    const store = getRateLimitStore();
    const now = Date.now();
    const [ipBlockedUntil, userBlockedUntil, comboBlockedUntil] = await Promise.all([
      store.getBlock(keys.ipKey),
      store.getBlock(keys.userKey),
      store.getBlock(keys.comboKey),
    ]);
    const blockedUntil = Math.max(
      ipBlockedUntil ?? 0,
      userBlockedUntil ?? 0,
      comboBlockedUntil ?? 0,
    );

    if (blockedUntil > now) {
      opLog({
        action: "ADMIN_LOGIN_RATE_LIMIT_BLOCKED",
        result: "error",
        message: `u=${keys.usernameHash.slice(0, 12)}; ip=${keys.ipHash.slice(0, 12)}`,
      });
      return {
        allowed: false,
        reason: "limited",
        retryAfterSeconds: toRetryAfterSeconds(blockedUntil, now),
      };
    }

    return { allowed: true };
  } catch (error) {
    if (isStoreUnavailable(error)) {
      logStoreFailure("ADMIN_LOGIN_RATE_LIMIT_STORE_UNAVAILABLE");
      return {
        allowed: false,
        reason: "infrastructure",
        retryAfterSeconds: INFRA_RETRY_SECONDS,
      };
    }

    throw error;
  }
}

export async function registerAdminLoginFailure(params: { username: string; ip: string }) {
  const keys = buildKey(params);

  try {
    const store = getRateLimitStore();
    const now = Date.now();
    const [ipBlockedUntil, userBlockedUntil, comboBlockedUntil] = await Promise.all([
      store.getBlock(keys.ipKey),
      store.getBlock(keys.userKey),
      store.getBlock(keys.comboKey),
    ]);
    const blockedUntil = Math.max(
      ipBlockedUntil ?? 0,
      userBlockedUntil ?? 0,
      comboBlockedUntil ?? 0,
    );
    if (blockedUntil > now) {
      return;
    }

    const [ipAttempts, userAttempts, comboAttempts] = await Promise.all([
      store.increment(keys.ipKey, WINDOW_MS),
      store.increment(keys.userKey, WINDOW_MS),
      store.increment(keys.comboKey, WINDOW_MS),
    ]);

    const ipBlockMs = resolveBlockDurationMs(ipAttempts, "ip");
    const userBlockMs = resolveBlockDurationMs(userAttempts, "user");
    const comboBlockMs = resolveBlockDurationMs(comboAttempts, "combo");

    await Promise.all([
      ipBlockMs ? store.setBlock(keys.ipKey, now + ipBlockMs) : Promise.resolve(),
      userBlockMs ? store.setBlock(keys.userKey, now + userBlockMs) : Promise.resolve(),
      comboBlockMs ? store.setBlock(keys.comboKey, now + comboBlockMs) : Promise.resolve(),
    ]);

    opLog({
      action: "ADMIN_LOGIN_FAILURE_RECORDED",
      result: "error",
      message: `u=${keys.usernameHash.slice(0, 12)}; ip=${keys.ipHash.slice(0, 12)}`,
    });
  } catch (error) {
    if (isStoreUnavailable(error)) {
      logStoreFailure("ADMIN_LOGIN_FAILURE_RATE_LIMIT_STORE_UNAVAILABLE");
      throw error;
    }

    throw error;
  }
}

export async function clearAdminLoginFailures(params: { username: string; ip: string }) {
  try {
    const store = getRateLimitStore();
    const keys = buildKey(params);
    await Promise.all([
      store.reset(keys.userKey),
      store.reset(keys.comboKey),
    ]);
  } catch (error) {
    if (isStoreUnavailable(error)) {
      logStoreFailure("ADMIN_LOGIN_CLEAR_RATE_LIMIT_STORE_UNAVAILABLE");
      return;
    }

    throw error;
  }
}
