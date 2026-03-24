import dotenv from "dotenv";
import { prisma } from "../src/lib/prisma";
import {
  decryptEncryptedSecretWithKeyMaterial,
  decryptSecretAtRest,
  encryptSecretAtRest,
  isEncryptedSecret,
  isLegacyPlaintextSecret,
  requireExplicitSecretEncryptionKey,
} from "../src/lib/secret-crypto";

dotenv.config();

const PREVIOUS_KEY_ENV = "TENANT_PAYMENT_SECRET_KEY_PREVIOUS";

type CliOptions = {
  dryRun: boolean;
  tenantId: number | null;
};

type SecretCandidate = {
  id: number;
  tenantId: number;
  provider: "IYZICO";
  rawSecret: string;
};

type EncryptedRowRef = {
  id: number;
  tenantId: number;
  provider: "IYZICO";
  ciphertext: string;
};

type ScanSummary = {
  totalConfigs: number;
  nonEmptySecrets: number;
  legacyPlaintextSecrets: number;
};

function printUsage(): void {
  console.log("Usage:");
  console.log(
    "  ts-node -P tsconfig.scripts.json scripts/backfill-encrypted-secrets.ts [--dry-run] [--write] [--tenant-id=<id>]",
  );
  console.log("");
  console.log("Flags:");
  console.log("  --dry-run        Sadece raporla (default).");
  console.log("  --write          Legacy plaintext -> encrypt; re-key migrate edilebilir kayitlari yazar.");
  console.log("  --tenant-id=<n>  Sadece ilgili tenant kayitlarini tarar.");
  console.log("");
  console.log("Re-key (enc:v1) icin:");
  console.log("  TENANT_PAYMENT_SECRET_KEY          = mevcut (yazim ve yeni sifreleme)");
  console.log(
    `  ${PREVIOUS_KEY_ENV} = opsiyonel; eski anahtarla sifrelenmis kayitlari cozmek icin`,
  );
}

function parseArgs(argv: string[]): CliOptions {
  let dryRun = true;
  let tenantId: number | null = null;

  for (const arg of argv) {
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--write") {
      dryRun = false;
      continue;
    }
    if (arg.startsWith("--tenant-id=")) {
      const raw = arg.slice("--tenant-id=".length).trim();
      const parsed = Number(raw);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("--tenant-id pozitif bir tam sayi olmali.");
      }
      tenantId = parsed;
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }

    throw new Error(`Bilinmeyen arguman: ${arg}`);
  }

  return { dryRun, tenantId };
}

async function scanLegacySecrets(options: {
  tenantId: number | null;
}): Promise<{ summary: ScanSummary; candidates: SecretCandidate[] }> {
  const rows = await prisma.tenantPaymentConfig.findMany({
    where: options.tenantId ? { tenantId: options.tenantId } : undefined,
    select: {
      id: true,
      tenantId: true,
      provider: true,
      secretKey: true,
    },
    orderBy: { id: "asc" },
  });

  let nonEmptySecrets = 0;
  const candidates: SecretCandidate[] = [];

  for (const row of rows) {
    const rawSecret = row.secretKey;
    if (typeof rawSecret !== "string") {
      continue;
    }
    const trimmed = rawSecret.trim();
    if (!trimmed) {
      continue;
    }

    nonEmptySecrets += 1;
    if (!isLegacyPlaintextSecret(trimmed)) {
      continue;
    }

    candidates.push({
      id: row.id,
      tenantId: row.tenantId,
      provider: row.provider,
      rawSecret,
    });
  }

  return {
    summary: {
      totalConfigs: rows.length,
      nonEmptySecrets,
      legacyPlaintextSecrets: candidates.length,
    },
    candidates,
  };
}

async function collectEncryptedRows(options: {
  tenantId: number | null;
}): Promise<EncryptedRowRef[]> {
  const rows = await prisma.tenantPaymentConfig.findMany({
    where: options.tenantId ? { tenantId: options.tenantId } : undefined,
    select: {
      id: true,
      tenantId: true,
      provider: true,
      secretKey: true,
    },
    orderBy: { id: "asc" },
  });

  const out: EncryptedRowRef[] = [];
  for (const row of rows) {
    const raw = row.secretKey;
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed || !isEncryptedSecret(trimmed)) continue;
    out.push({
      id: row.id,
      tenantId: row.tenantId,
      provider: row.provider,
      ciphertext: trimmed,
    });
  }
  return out;
}

type RekeyClassify = {
  readableWithCurrent: number;
  migratableWithPrevious: number;
  unrecoverable: number;
};

function classifyRekey(
  rows: EncryptedRowRef[],
  previousKeyRaw: string | undefined,
): { byRow: Map<number, "current" | "previous" | "lost">; summary: RekeyClassify } {
  const byRow = new Map<number, "current" | "previous" | "lost">();
  let readableWithCurrent = 0;
  let migratableWithPrevious = 0;
  let unrecoverable = 0;

  for (const row of rows) {
    const plainCurrent = decryptSecretAtRest(row.ciphertext);
    if (plainCurrent) {
      readableWithCurrent += 1;
      byRow.set(row.id, "current");
      continue;
    }
    if (previousKeyRaw?.trim()) {
      const plainPrev = decryptEncryptedSecretWithKeyMaterial(
        row.ciphertext,
        previousKeyRaw,
      );
      if (plainPrev) {
        migratableWithPrevious += 1;
        byRow.set(row.id, "previous");
        continue;
      }
    }
    unrecoverable += 1;
    byRow.set(row.id, "lost");
  }

  return {
    byRow,
    summary: {
      readableWithCurrent,
      migratableWithPrevious,
      unrecoverable,
    },
  };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const modeLabel = options.dryRun ? "DRY-RUN" : "WRITE";

  console.log(`[backfill-secrets] mode=${modeLabel}`);
  if (options.tenantId != null) {
    console.log(`[backfill-secrets] tenant filter: ${options.tenantId}`);
  }

  const previousKeyRaw = process.env[PREVIOUS_KEY_ENV]?.trim() || undefined;
  if (previousKeyRaw) {
    console.log(`[backfill-secrets] ${PREVIOUS_KEY_ENV} is set (value not shown)`);
  }

  const { summary, candidates } = await scanLegacySecrets({
    tenantId: options.tenantId,
  });

  const encryptedRows = await collectEncryptedRows({ tenantId: options.tenantId });

  if (!options.dryRun || encryptedRows.length > 0) {
    requireExplicitSecretEncryptionKey();
  }
  const rekey = classifyRekey(encryptedRows, previousKeyRaw);

  console.log(
    `[backfill-secrets] scanned=${summary.totalConfigs}, nonEmptySecrets=${summary.nonEmptySecrets}, legacyPlaintext=${summary.legacyPlaintextSecrets}`,
  );
  console.log(
    `[backfill-secrets] encrypted: readableWithCurrent=${rekey.summary.readableWithCurrent}, migratableWithPrevious=${rekey.summary.migratableWithPrevious}, unrecoverable=${rekey.summary.unrecoverable}`,
  );

  if (candidates.length > 0) {
    const preview = candidates.slice(0, 20).map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      provider: row.provider,
    }));
    console.log("[backfill-secrets] legacy plaintext candidates preview (max 20):");
    console.table(preview);
    if (candidates.length > preview.length) {
      console.log(
        `[backfill-secrets] ... +${candidates.length - preview.length} additional legacy record(s).`,
      );
    }
  }

  if (options.dryRun) {
    console.log("[backfill-secrets] dry-run tamamlandi, veri yazilmadi.");
    return;
  }

  let convertedLegacy = 0;
  let skippedLegacy = 0;
  let failedLegacy = 0;

  for (const candidate of candidates) {
    try {
      const encrypted = encryptSecretAtRest(candidate.rawSecret);
      const updated = await prisma.tenantPaymentConfig.updateMany({
        where: {
          id: candidate.id,
          secretKey: candidate.rawSecret,
        },
        data: {
          secretKey: encrypted,
        },
      });

      if (updated.count > 0) {
        convertedLegacy += 1;
      } else {
        skippedLegacy += 1;
      }
    } catch {
      failedLegacy += 1;
    }
  }

  let rekeyConverted = 0;
  let rekeySkipped = 0;
  let rekeyFailed = 0;

  for (const row of encryptedRows) {
    const kind = rekey.byRow.get(row.id);
    if (kind !== "previous") {
      continue;
    }
    try {
      const prev = previousKeyRaw;
      if (!prev) continue;
      const plain = decryptEncryptedSecretWithKeyMaterial(row.ciphertext, prev);
      if (!plain) {
        rekeyFailed += 1;
        continue;
      }
      const encrypted = encryptSecretAtRest(plain);
      const updated = await prisma.tenantPaymentConfig.updateMany({
        where: {
          id: row.id,
          secretKey: row.ciphertext,
        },
        data: {
          secretKey: encrypted,
        },
      });
      if (updated.count > 0) {
        rekeyConverted += 1;
      } else {
        rekeySkipped += 1;
      }
    } catch {
      rekeyFailed += 1;
    }
  }

  const postScan = await scanLegacySecrets({ tenantId: options.tenantId });
  const postEncrypted = await collectEncryptedRows({ tenantId: options.tenantId });
  const postRekey = classifyRekey(postEncrypted, previousKeyRaw);

  console.log(
    `[backfill-secrets] legacy: converted=${convertedLegacy}, skipped=${skippedLegacy}, failed=${failedLegacy}, remainingLegacy=${postScan.summary.legacyPlaintextSecrets}`,
  );
  console.log(
    `[backfill-secrets] rekey: converted=${rekeyConverted}, skipped=${rekeySkipped}, failed=${rekeyFailed}, after: migratable=${postRekey.summary.migratableWithPrevious}, unrecoverable=${postRekey.summary.unrecoverable}`,
  );

  if (failedLegacy > 0 || rekeyFailed > 0) {
    throw new Error("Bazi kayitlar donusturulemedi. Loglari kontrol edin.");
  }
}

main()
  .catch((error) => {
    const safeMessage = error instanceof Error ? error.message : String(error);
    console.error(`[backfill-secrets] failed: ${safeMessage}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
