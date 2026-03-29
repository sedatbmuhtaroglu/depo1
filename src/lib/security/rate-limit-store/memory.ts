import {
  RateLimitSnapshot,
  RateLimitStore,
  type TryAcquireCooldownResult,
} from "@/lib/security/rate-limit-store/types";

type MemoryState = {
  attempts: number[];
  blockedUntil: number | null;
  cooldownUntil: number | null;
};

function createInitialState(): MemoryState {
  return {
    attempts: [],
    blockedUntil: null,
    cooldownUntil: null,
  };
}

export class MemoryRateLimitStore implements RateLimitStore {
  private states = new Map<string, MemoryState>();

  private getOrCreateState(key: string): MemoryState {
    const existing = this.states.get(key);
    if (existing) return existing;
    const created = createInitialState();
    this.states.set(key, created);
    return created;
  }

  private cloneSnapshot(state: MemoryState): RateLimitSnapshot {
    return {
      attempts: [...state.attempts],
      blockedUntil: state.blockedUntil,
      cooldownUntil: state.cooldownUntil,
    };
  }

  private pruneAttempts(state: MemoryState, windowMs: number, nowMs: number) {
    const threshold = nowMs - Math.max(1, windowMs);
    state.attempts = state.attempts.filter((ts) => ts >= threshold);
  }

  async get(key: string): Promise<RateLimitSnapshot | null> {
    const state = this.states.get(key);
    if (!state) return null;
    return this.cloneSnapshot(state);
  }

  async increment(key: string, windowMs: number): Promise<number> {
    const nowMs = Date.now();
    const state = this.getOrCreateState(key);
    this.pruneAttempts(state, windowMs, nowMs);
    state.attempts.push(nowMs);
    return state.attempts.length;
  }

  async setBlock(key: string, until: number): Promise<void> {
    const state = this.getOrCreateState(key);
    state.blockedUntil = until;
  }

  async getBlock(key: string): Promise<number | null> {
    const state = this.states.get(key);
    return state?.blockedUntil ?? null;
  }

  async touchCooldown(key: string, until: number): Promise<void> {
    const state = this.getOrCreateState(key);
    state.cooldownUntil = until;
  }

  async getCooldown(key: string): Promise<number | null> {
    const state = this.states.get(key);
    return state?.cooldownUntil ?? null;
  }

  async tryAcquireCooldown(key: string, cooldownMs: number): Promise<TryAcquireCooldownResult> {
    const nowMs = Date.now();
    const state = this.getOrCreateState(key);
    const safeMs = Math.max(1, Math.trunc(cooldownMs));
    if (state.cooldownUntil && nowMs < state.cooldownUntil) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((state.cooldownUntil - nowMs) / 1000),
      );
      return { ok: false, retryAfterSeconds };
    }
    state.cooldownUntil = nowMs + safeMs;
    return { ok: true };
  }

  async reset(key: string): Promise<void> {
    this.states.delete(key);
  }
}
