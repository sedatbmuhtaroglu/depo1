import { createClient } from "redis";
import { SECURITY_RUNTIME_CONFIG } from "@/lib/security/config";
import {
  RateLimitSnapshot,
  RateLimitStore,
  RateLimitStoreUnavailableError,
} from "@/lib/security/rate-limit-store/types";

type RedisClient = ReturnType<typeof createClient>;

type RedisRuntimeState = {
  client: RedisClient;
  ready: Promise<RedisClient>;
  url: string;
};

const globalState = globalThis as typeof globalThis & {
  __rateLimitRedisState?: RedisRuntimeState;
};

const INCR_WITH_WINDOW_SCRIPT = `
local value = redis.call("INCR", KEYS[1])
if value == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
return value
`;

/** Atomik cooldown: PTTL > 0 ise red + kalan sn; yoksa SET PX ile yeni cooldown. */
const TRY_ACQUIRE_COOLDOWN_SCRIPT = `
local ttl = redis.call('PTTL', KEYS[1])
if ttl > 0 then
  return {0, math.max(1, math.ceil(ttl / 1000))}
end
redis.call('SET', KEYS[1], '1', 'PX', ARGV[1])
return {1, 0}
`;

function parseInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.trunc(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return Math.trunc(parsed);
    }
  }

  return null;
}

function resolveRedisPrefix(): string {
  const raw = SECURITY_RUNTIME_CONFIG.redisPrefix?.trim();
  return raw && raw.length > 0 ? raw : "qrmenu:ratelimit";
}

function normalizeRedisUrl(rawUrl: string | undefined): string {
  const trimmed = rawUrl?.trim();
  if (!trimmed) {
    throw new RateLimitStoreUnavailableError(
      "REDIS_URL is required when RATE_LIMIT_STORE=redis.",
    );
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
      throw new RateLimitStoreUnavailableError("REDIS_URL must use redis:// or rediss:// scheme.");
    }
    return parsed.toString();
  } catch (error) {
    if (error instanceof RateLimitStoreUnavailableError) {
      throw error;
    }
    throw new RateLimitStoreUnavailableError("REDIS_URL is invalid.", { cause: error });
  }
}

function createRuntimeState(redisUrl: string): RedisRuntimeState {
  const client = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy(retries) {
        if (retries > 8) {
          return new Error("Redis reconnect retry limit exceeded.");
        }
        return Math.min(1000 * 2 ** retries, 10_000);
      },
    },
  });

  client.on("error", (error) => {
    console.error("[security] Redis rate limit client error:", error instanceof Error ? error.message : error);
  });

  const ready = client
    .connect()
    .then(() => client)
    .catch((error) => {
      throw new RateLimitStoreUnavailableError("Redis rate limit store connection failed.", {
        cause: error,
      });
    });

  return {
    client,
    ready,
    url: redisUrl,
  };
}

function getRuntimeState(redisUrl: string): RedisRuntimeState {
  const current = globalState.__rateLimitRedisState;
  if (current && current.url === redisUrl) {
    return current;
  }

  const nextState = createRuntimeState(redisUrl);
  globalState.__rateLimitRedisState = nextState;
  return nextState;
}

export class RedisRateLimitStore implements RateLimitStore {
  private readonly prefix: string;
  private readonly runtime: RedisRuntimeState;

  constructor(options?: { redisUrl?: string; prefix?: string }) {
    const redisUrl = normalizeRedisUrl(options?.redisUrl ?? process.env.REDIS_URL);
    this.prefix = options?.prefix?.trim() || resolveRedisPrefix();
    this.runtime = getRuntimeState(redisUrl);
  }

  private attemptsKey(key: string) {
    return `${this.prefix}:${key}:attempts`;
  }

  private blockKey(key: string) {
    return `${this.prefix}:${key}:block`;
  }

  private cooldownKey(key: string) {
    return `${this.prefix}:${key}:cooldown`;
  }

  private async withClient<T>(operation: string, callback: (client: RedisClient) => Promise<T>): Promise<T> {
    let client: RedisClient;

    try {
      client = await this.runtime.ready;
    } catch (error) {
      throw new RateLimitStoreUnavailableError(
        `Redis rate limit store unavailable during ${operation}.`,
        { cause: error },
      );
    }

    try {
      return await callback(client);
    } catch (error) {
      throw new RateLimitStoreUnavailableError(
        `Redis rate limit operation failed (${operation}).`,
        { cause: error },
      );
    }
  }

  async get(key: string): Promise<RateLimitSnapshot | null> {
    return this.withClient("get", async (client) => {
      const [attemptRaw, blockedRaw, cooldownRaw] = await client.mGet([
        this.attemptsKey(key),
        this.blockKey(key),
        this.cooldownKey(key),
      ]);

      const blockedUntil = parseInteger(blockedRaw);
      const cooldownUntil = parseInteger(cooldownRaw);
      const attemptsCount = Math.max(parseInteger(attemptRaw) ?? 0, 0);

      if (attemptsCount === 0 && blockedUntil === null && cooldownUntil === null) {
        return null;
      }

      return {
        attempts: attemptsCount > 0 ? [attemptsCount] : [],
        blockedUntil,
        cooldownUntil,
      };
    });
  }

  async increment(key: string, windowMs: number): Promise<number> {
    return this.withClient("increment", async (client) => {
      const safeWindowMs = Math.max(1, Math.trunc(windowMs));
      const result = await client.eval(INCR_WITH_WINDOW_SCRIPT, {
        keys: [this.attemptsKey(key)],
        arguments: [String(safeWindowMs)],
      });

      const parsed = parseInteger(result);
      if (parsed === null || parsed < 0) {
        throw new Error("Redis increment returned invalid response.");
      }

      return parsed;
    });
  }

  async setBlock(key: string, until: number): Promise<void> {
    await this.withClient("setBlock", async (client) => {
      const ttlMs = Math.max(0, Math.trunc(until - Date.now()));
      const blockKey = this.blockKey(key);

      if (ttlMs <= 0) {
        await client.del(blockKey);
        return;
      }

      await client.set(blockKey, String(Math.trunc(until)), {
        PX: ttlMs,
      });
    });
  }

  async getBlock(key: string): Promise<number | null> {
    return this.withClient("getBlock", async (client) => {
      const value = await client.get(this.blockKey(key));
      return parseInteger(value);
    });
  }

  async touchCooldown(key: string, until: number): Promise<void> {
    await this.withClient("touchCooldown", async (client) => {
      const ttlMs = Math.max(0, Math.trunc(until - Date.now()));
      const cooldownKey = this.cooldownKey(key);

      if (ttlMs <= 0) {
        await client.del(cooldownKey);
        return;
      }

      await client.set(cooldownKey, String(Math.trunc(until)), {
        PX: ttlMs,
      });
    });
  }

  async getCooldown(key: string): Promise<number | null> {
    return this.withClient("getCooldown", async (client) => {
      const value = await client.get(this.cooldownKey(key));
      return parseInteger(value);
    });
  }

  async tryAcquireCooldown(key: string, cooldownMs: number) {
    return this.withClient("tryAcquireCooldown", async (client) => {
      const safeMs = Math.max(1, Math.trunc(cooldownMs));
      const raw = await client.eval(TRY_ACQUIRE_COOLDOWN_SCRIPT, {
        keys: [this.cooldownKey(key)],
        arguments: [String(safeMs)],
      });

      if (!Array.isArray(raw) || raw.length < 2) {
        throw new Error("Redis tryAcquireCooldown returned invalid response.");
      }

      const allowed = parseInteger(raw[0]);
      const retryAfter = parseInteger(raw[1]);
      if (allowed !== 0 && allowed !== 1) {
        throw new Error("Redis tryAcquireCooldown allowed flag invalid.");
      }
      if (retryAfter === null || retryAfter < 0) {
        throw new Error("Redis tryAcquireCooldown retryAfter invalid.");
      }

      if (allowed === 1) {
        return { ok: true as const };
      }
      return { ok: false as const, retryAfterSeconds: Math.max(1, retryAfter) };
    });
  }

  async reset(key: string): Promise<void> {
    await this.withClient("reset", async (client) => {
      await client.del([
        this.attemptsKey(key),
        this.blockKey(key),
        this.cooldownKey(key),
      ]);
    });
  }
}
