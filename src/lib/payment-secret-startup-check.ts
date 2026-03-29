import { prisma } from "@/lib/prisma";

const ENCRYPTED_SECRET_PREFIX = "enc:v1:";
const ENCRYPTION_KEY_ENV_NAME = "TENANT_PAYMENT_SECRET_KEY";

let startupSecretCheckPromise: Promise<void> | null = null;

function shouldRunStartupCheck(): boolean {
  const startupCheckEnv = (process.env.PAYMENT_SECRET_STARTUP_CHECK ?? "").trim().toLowerCase();
  if (startupCheckEnv === "false") {
    return false;
  }
  if (process.env.NODE_ENV === "production" && startupCheckEnv !== "true") {
    return false;
  }
  return true;
}

function hasConfiguredEncryptionKeyEnv(): boolean {
  const raw = process.env[ENCRYPTION_KEY_ENV_NAME];
  return Boolean(raw && raw.trim() !== "");
}

export async function warnIfLegacyPaymentSecretsPresentAtStartup(): Promise<void> {
  if (!shouldRunStartupCheck()) {
    return;
  }
  if (startupSecretCheckPromise) {
    return startupSecretCheckPromise;
  }

  startupSecretCheckPromise = (async () => {
    try {
      const configs = await prisma.tenantPaymentConfig.findMany({
        select: { secretKey: true },
      });

      let encryptedCount = 0;
      let legacyCount = 0;
      for (const config of configs) {
        const secret = config.secretKey?.trim();
        if (!secret) continue;
        if (secret.startsWith(ENCRYPTED_SECRET_PREFIX)) {
          encryptedCount += 1;
        } else {
          legacyCount += 1;
        }
      }

      if (legacyCount > 0) {
        console.warn(
          `[payment-secret] ${legacyCount} legacy plaintext payment secret record(s) detected. Run npm run secrets:backfill.`,
        );
      }

      if (encryptedCount > 0 && !hasConfiguredEncryptionKeyEnv()) {
        console.warn(
          `[payment-secret] Encrypted payment secrets exist but ${ENCRYPTION_KEY_ENV_NAME} env is empty. Payment provider calls may fail.`,
        );
      }
    } catch {
      console.warn("[payment-secret] Startup secret health check skipped due to an internal error.");
    }
  })();

  return startupSecretCheckPromise;
}
