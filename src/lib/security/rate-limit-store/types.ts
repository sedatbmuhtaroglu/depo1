export type RateLimitSnapshot = {
  attempts: number[];
  blockedUntil: number | null;
  cooldownUntil: number | null;
};

export class RateLimitStoreUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RateLimitStoreUnavailableError";
  }
}

export type TryAcquireCooldownResult =
  | { ok: true }
  | { ok: false; retryAfterSeconds: number };

export interface RateLimitStore {
  get(key: string): Promise<RateLimitSnapshot | null>;
  increment(key: string, windowMs: number): Promise<number>;
  setBlock(key: string, until: number): Promise<void>;
  getBlock(key: string): Promise<number | null>;
  touchCooldown(key: string, until: number): Promise<void>;
  getCooldown(key: string): Promise<number | null>;
  /**
   * Atomik: anahtar yoksa veya süresi dolmuşsa cooldown yazar ve izin verir;
   * aktif cooldown varsa kalan süreyi döner (Redis PTTL ile uyumlu).
   */
  tryAcquireCooldown(key: string, cooldownMs: number): Promise<TryAcquireCooldownResult>;
  reset(key: string): Promise<void>;
}
