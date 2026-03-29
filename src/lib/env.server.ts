/** Same name as `SECRET_ENCRYPTION_ENV_KEY` in secret-crypto (avoid importing crypto in this module). */
const TENANT_PAYMENT_SECRET_KEY_ENV = "TENANT_PAYMENT_SECRET_KEY";

function trimEnv(name: string): string {
  return (process.env[name] ?? "").trim();
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

function isValidTenantPaymentSecretKey(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) return true;
  if (trimmed.startsWith("base64:")) {
    try {
      return Buffer.from(trimmed.slice("base64:".length), "base64").length === 32;
    } catch {
      return false;
    }
  }
  try {
    const b64 = Buffer.from(trimmed, "base64");
    if (b64.length === 32) return true;
  } catch {
    /* ignore */
  }
  return Buffer.from(trimmed, "utf8").length === 32;
}

/**
 * Fail-fast validation for production deployments. Safe to call from instrumentation.
 * Does not log secret values.
 */
export function assertProductionEnvOrThrow(): void {
  if (!isProduction()) {
    return;
  }

  const errors: string[] = [];

  if (!trimEnv("DATABASE_URL")) {
    errors.push("DATABASE_URL is required.");
  }

  if (!trimEnv("ADMIN_SESSION_SECRET")) {
    errors.push("ADMIN_SESSION_SECRET is required.");
  }

  const paymentKey = trimEnv(TENANT_PAYMENT_SECRET_KEY_ENV);
  if (!paymentKey) {
    errors.push(`${TENANT_PAYMENT_SECRET_KEY_ENV} is required.`);
  } else if (!isValidTenantPaymentSecretKey(paymentKey)) {
    errors.push(`${TENANT_PAYMENT_SECRET_KEY_ENV} is present but invalid (expect 32-byte hex/base64).`);
  }

  const rateStore = (process.env.RATE_LIMIT_STORE ?? "").trim().toLowerCase();
  if (rateStore === "redis" && !trimEnv("REDIS_URL")) {
    errors.push("REDIS_URL is required when RATE_LIMIT_STORE=redis.");
  }

  if (!trimEnv("APP_BASE_URL")) {
    errors.push("APP_BASE_URL is required in production (canonical HTTPS origin for callbacks and host allowlist).");
  }

  if (errors.length > 0) {
    throw new Error(`[env] Production configuration incomplete:\n- ${errors.join("\n- ")}`);
  }
}
