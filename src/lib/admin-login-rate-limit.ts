import { headers } from "next/headers";
import { opLog } from "@/lib/op-logger";
import { hashValue } from "@/lib/security/hash";
import { getRateLimitStore } from "@/lib/security/rate-limit-store";
import { RateLimitStoreUnavailableError } from "@/lib/security/rate-limit-store/types";

type LoginRateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number; reason: "limited" | "infrastructure" };

const WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 8;
const BLOCK_DURATION_MS = 15 * 60 * 1000;
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
  return `admin-login:user:${usernameHash}:ip:${ipHash}`;
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
  const key = buildKey(params);

  try {
    const store = getRateLimitStore();
    const now = Date.now();
    const blockedUntil = await store.getBlock(key);

    if (blockedUntil && blockedUntil > now) {
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
  const key = buildKey(params);

  try {
    const store = getRateLimitStore();
    const now = Date.now();
    const blockedUntil = await store.getBlock(key);
    if (blockedUntil && blockedUntil > now) {
      return;
    }

    const attempts = await store.increment(key, WINDOW_MS);
    if (attempts >= MAX_ATTEMPTS) {
      await store.setBlock(key, now + BLOCK_DURATION_MS);
    }
  } catch (error) {
    if (isStoreUnavailable(error)) {
      logStoreFailure("ADMIN_LOGIN_FAILURE_RATE_LIMIT_STORE_UNAVAILABLE");
      return;
    }

    throw error;
  }
}

export async function clearAdminLoginFailures(params: { username: string; ip: string }) {
  try {
    const store = getRateLimitStore();
    await store.reset(buildKey(params));
  } catch (error) {
    if (isStoreUnavailable(error)) {
      logStoreFailure("ADMIN_LOGIN_CLEAR_RATE_LIMIT_STORE_UNAVAILABLE");
      return;
    }

    throw error;
  }
}
