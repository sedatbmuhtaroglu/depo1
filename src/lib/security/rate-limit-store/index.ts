import { SECURITY_RUNTIME_CONFIG } from "@/lib/security/config";
import { MemoryRateLimitStore } from "@/lib/security/rate-limit-store/memory";
import { RedisRateLimitStore } from "@/lib/security/rate-limit-store/redis";
import {
  RateLimitStore,
  RateLimitStoreUnavailableError,
  type TryAcquireCooldownResult,
} from "@/lib/security/rate-limit-store/types";

const memoryStore = new MemoryRateLimitStore();

let resolvedStore: RateLimitStore | null = null;
let warnedMemoryInProd = false;
let warnedRedisToMemoryInDev = false;
let warnedRedisRuntimeFallbackInDev = false;

function warnMemoryStoreInProductionOnce() {
  if (warnedMemoryInProd) return;
  warnedMemoryInProd = true;
  console.warn(
    "[security] RATE_LIMIT_STORE=memory in production. Use redis mode for distributed enforcement.",
  );
}

function warnRedisFallbackInDevOnce(error: unknown) {
  if (warnedRedisToMemoryInDev) return;
  warnedRedisToMemoryInDev = true;
  const message = error instanceof Error ? error.message : String(error);
  console.warn(
    `[security] Redis rate limit store could not be initialized in development. Falling back to memory. reason=${message}`,
  );
}

function warnRedisRuntimeFallbackInDevOnce(error: unknown) {
  if (warnedRedisRuntimeFallbackInDev) return;
  warnedRedisRuntimeFallbackInDev = true;
  const message = error instanceof Error ? error.message : String(error);
  console.warn(
    `[security] Redis rate limit runtime unavailable in development. Memory fallback is active. reason=${message}`,
  );
}

class DevFallbackRateLimitStore implements RateLimitStore {
  constructor(
    private readonly redisStore: RateLimitStore,
    private readonly memoryFallbackStore: RateLimitStore,
  ) {}

  private async useRedisOrMemory<T>(callback: (store: RateLimitStore) => Promise<T>): Promise<T> {
    try {
      return await callback(this.redisStore);
    } catch (error) {
      if (!(error instanceof RateLimitStoreUnavailableError)) {
        throw error;
      }
      warnRedisRuntimeFallbackInDevOnce(error);
      return callback(this.memoryFallbackStore);
    }
  }

  async get(key: string) {
    return this.useRedisOrMemory((store) => store.get(key));
  }

  async increment(key: string, windowMs: number) {
    return this.useRedisOrMemory((store) => store.increment(key, windowMs));
  }

  async setBlock(key: string, until: number) {
    return this.useRedisOrMemory((store) => store.setBlock(key, until));
  }

  async getBlock(key: string) {
    return this.useRedisOrMemory((store) => store.getBlock(key));
  }

  async touchCooldown(key: string, until: number) {
    return this.useRedisOrMemory((store) => store.touchCooldown(key, until));
  }

  async getCooldown(key: string) {
    return this.useRedisOrMemory((store) => store.getCooldown(key));
  }

  async tryAcquireCooldown(key: string, cooldownMs: number): Promise<TryAcquireCooldownResult> {
    return this.useRedisOrMemory((store) => store.tryAcquireCooldown(key, cooldownMs));
  }

  async reset(key: string) {
    return this.useRedisOrMemory((store) => store.reset(key));
  }
}

function createRedisStoreOrThrow(): RateLimitStore {
  try {
    return new RedisRateLimitStore();
  } catch (error) {
    if (error instanceof RateLimitStoreUnavailableError) {
      throw error;
    }

    throw new RateLimitStoreUnavailableError(
      "Redis rate limit store initialization failed.",
      { cause: error },
    );
  }
}

function resolveStore(): RateLimitStore {
  const mode = SECURITY_RUNTIME_CONFIG.rateLimitStoreMode;
  const isProduction = process.env.NODE_ENV === "production";

  if (mode === "memory") {
    if (isProduction) {
      warnMemoryStoreInProductionOnce();
    }
    return memoryStore;
  }

  try {
    const redisStore = createRedisStoreOrThrow();
    if (isProduction) {
      return redisStore;
    }
    return new DevFallbackRateLimitStore(redisStore, memoryStore);
  } catch (error) {
    if (isProduction) {
      throw error;
    }

    warnRedisFallbackInDevOnce(error);
    return memoryStore;
  }
}

export function getRateLimitStore(): RateLimitStore {
  if (!resolvedStore) {
    resolvedStore = resolveStore();
  }

  return resolvedStore;
}
