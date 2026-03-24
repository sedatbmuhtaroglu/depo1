/**
 * iyzico config check only (no iyzipay package import).
 * Use this in server components. Use @/lib/iyzico for API/actions.
 */
import { prisma } from "@/lib/prisma";
import {
  canDecryptEncryptedSecrets,
  decryptSecretAtRest,
  encryptSecretAtRest,
  hasExplicitSecretEncryptionKey,
  isEncryptedSecret,
  isLegacyPlaintextSecret,
} from "@/lib/secret-crypto";

type IyzicoConfigRow = {
  id: number;
  tenantId: number;
  apiKey: string | null;
  secretKey: string | null;
  isSandbox: boolean;
  isActive: boolean;
};

type ResolvedSecretState = {
  value: string | null;
  isLegacyPlaintext: boolean;
  rawLegacySecret: string | null;
};

const legacySecretWarnedConfigIds = new Set<number>();
const unreadableEncryptedWarnedConfigIds = new Set<number>();
const legacyBackfillInFlight = new Set<number>();

function resolveSecretForRuntime(config: IyzicoConfigRow | null): ResolvedSecretState {
  const rawSecret = config?.secretKey;
  const trimmed = rawSecret?.trim();
  if (!trimmed) {
    return { value: null, isLegacyPlaintext: false, rawLegacySecret: null };
  }

  if (isLegacyPlaintextSecret(trimmed)) {
    if (config && !legacySecretWarnedConfigIds.has(config.id)) {
      legacySecretWarnedConfigIds.add(config.id);
      const detail =
        process.env.NODE_ENV === "production"
          ? "provider=IYZICO. Run secrets backfill."
          : `tenant=${config.tenantId}, provider=IYZICO. Run secrets backfill.`;
      console.warn(`[payment-secret] Legacy plaintext secret detected for ${detail}`);
    }
    return { value: trimmed, isLegacyPlaintext: true, rawLegacySecret: rawSecret ?? null };
  }

  if (!isEncryptedSecret(trimmed)) {
    return { value: null, isLegacyPlaintext: false, rawLegacySecret: null };
  }

  const resolved = decryptSecretAtRest(trimmed);
  if (!resolved || resolved.trim() === "") {
    if (config && !unreadableEncryptedWarnedConfigIds.has(config.id)) {
      unreadableEncryptedWarnedConfigIds.add(config.id);
      const detail =
        process.env.NODE_ENV === "production"
          ? "provider=IYZICO."
          : `tenant=${config.tenantId}, provider=IYZICO.`;
      const explicit = hasExplicitSecretEncryptionKey();
      const keyLoaded = canDecryptEncryptedSecrets();
      let diagnosis: string;
      if (!keyLoaded) {
        diagnosis =
          "No encryption key loaded (set TENANT_PAYMENT_SECRET_KEY or ALLOW_DEV_PAYMENT_SECRET_FALLBACK=true for local dev only).";
      } else if (!explicit) {
        diagnosis =
          "Dev fallback key may not match ciphertext from another environment; use the same TENANT_PAYMENT_SECRET_KEY used when encrypting.";
      } else {
        diagnosis =
          "Key mismatch after rotation or corrupted ciphertext; re-save Iyzico payment settings or run npm run secrets:backfill.";
      }
      console.warn(
        `[payment-secret] Encrypted secret could not be decrypted for ${detail} ${diagnosis}`,
      );
    }
    return { value: null, isLegacyPlaintext: false, rawLegacySecret: null };
  }

  return {
    value: resolved.trim(),
    isLegacyPlaintext: false,
    rawLegacySecret: null,
  };
}

async function maybeBackfillLegacySecret(config: IyzicoConfigRow, rawSecret: string): Promise<void> {
  if (legacyBackfillInFlight.has(config.id)) {
    return;
  }
  legacyBackfillInFlight.add(config.id);

  try {
    if (!hasExplicitSecretEncryptionKey()) {
      const detail =
        process.env.NODE_ENV === "production"
          ? "provider=IYZICO because encryption key env is missing or invalid."
          : `tenant=${config.tenantId}, provider=IYZICO because encryption key env is missing or invalid.`;
      console.warn(`[payment-secret] Legacy plaintext secret could not be auto-migrated for ${detail}`);
      return;
    }

    const encrypted = encryptSecretAtRest(rawSecret);
    const updated = await prisma.tenantPaymentConfig.updateMany({
      where: {
        id: config.id,
        secretKey: rawSecret,
      },
      data: {
        secretKey: encrypted,
      },
    });

    if (updated.count > 0 && process.env.NODE_ENV !== "production") {
      console.info(
        `[payment-secret] Legacy plaintext secret auto-migrated for tenant=${config.tenantId}, provider=IYZICO.`,
      );
    }
  } catch {
    const detail =
      process.env.NODE_ENV === "production"
        ? "provider=IYZICO."
        : `tenant=${config.tenantId}, provider=IYZICO.`;
    console.warn(`[payment-secret] Legacy plaintext secret auto-migration failed for ${detail}`);
  } finally {
    legacyBackfillInFlight.delete(config.id);
  }
}

async function getIyzicoConfigRow(tenantId: number): Promise<IyzicoConfigRow | null> {
  return prisma.tenantPaymentConfig.findUnique({
    where: {
      tenantId_provider: { tenantId, provider: "IYZICO" },
    },
    select: {
      id: true,
      tenantId: true,
      apiKey: true,
      secretKey: true,
      isSandbox: true,
      isActive: true,
    },
  });
}

function scheduleLegacyBackfillIfNeeded(config: IyzicoConfigRow | null, state: ResolvedSecretState) {
  if (!config || !state.isLegacyPlaintext || !state.rawLegacySecret) {
    return;
  }
  void maybeBackfillLegacySecret(config, state.rawLegacySecret);
}

/** Tenant icin iyzico aktif mi (ayarlardan kayitli ve aktif). */
export async function getIyzicoEnabledForTenant(tenantId: number): Promise<boolean> {
  const config = await getIyzicoConfigRow(tenantId);
  const secretState = resolveSecretForRuntime(config);
  scheduleLegacyBackfillIfNeeded(config, secretState);

  return Boolean(
    config?.isActive &&
      config.apiKey &&
      config.apiKey.trim() !== "" &&
      secretState.value,
  );
}

/** Tenant iyzico config (API route/action icinde kullan). */
export async function getIyzicoConfigForTenant(tenantId: number): Promise<{
  apiKey: string;
  secretKey: string;
  isSandbox: boolean;
} | null> {
  const config = await getIyzicoConfigRow(tenantId);
  const secretState = resolveSecretForRuntime(config);
  scheduleLegacyBackfillIfNeeded(config, secretState);

  if (!config?.isActive || !config.apiKey?.trim() || !secretState.value) {
    return null;
  }

  return {
    apiKey: config.apiKey.trim(),
    secretKey: secretState.value,
    isSandbox: config.isSandbox,
  };
}
