import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const ENCRYPTED_PREFIX = "enc:v1:";

type CliOptions = {
  tenantId: number | null;
};

type LegacySecretRef = {
  id: number;
  tenantId: number;
  provider: "IYZICO";
};

type VerificationSummary = {
  totalConfigs: number;
  nonEmptySecrets: number;
  encryptedSecrets: number;
  legacySecrets: number;
};

function printUsage(): void {
  console.log("Usage:");
  console.log("  ts-node scripts/verify-encrypted-secrets.ts [--tenant-id=<id>]");
  console.log("");
  console.log("Flags:");
  console.log("  --tenant-id=<n>  Sadece ilgili tenant kayitlarini dogrular.");
}

function parseArgs(argv: string[]): CliOptions {
  let tenantId: number | null = null;

  for (const arg of argv) {
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

  return { tenantId };
}

function isLegacySecret(secretKey: string): boolean {
  return !secretKey.startsWith(ENCRYPTED_PREFIX);
}

async function verifySecrets(options: CliOptions): Promise<{
  summary: VerificationSummary;
  legacyRecords: LegacySecretRef[];
}> {
  const prisma = new PrismaClient();

  try {
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
    let encryptedSecrets = 0;
    const legacyRecords: LegacySecretRef[] = [];

    for (const row of rows) {
      if (typeof row.secretKey !== "string") {
        continue;
      }

      const trimmed = row.secretKey.trim();
      if (!trimmed) {
        continue;
      }

      nonEmptySecrets += 1;
      if (isLegacySecret(trimmed)) {
        legacyRecords.push({
          id: row.id,
          tenantId: row.tenantId,
          provider: row.provider,
        });
      } else {
        encryptedSecrets += 1;
      }
    }

    return {
      summary: {
        totalConfigs: rows.length,
        nonEmptySecrets,
        encryptedSecrets,
        legacySecrets: legacyRecords.length,
      },
      legacyRecords,
    };
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  console.log("[verify-secrets] mode=VERIFY");
  if (options.tenantId != null) {
    console.log(`[verify-secrets] tenant filter: ${options.tenantId}`);
  }

  const { summary, legacyRecords } = await verifySecrets(options);
  console.log(
    `[verify-secrets] scanned=${summary.totalConfigs}, nonEmptySecrets=${summary.nonEmptySecrets}, encrypted=${summary.encryptedSecrets}, legacy=${summary.legacySecrets}`,
  );

  if (legacyRecords.length > 0) {
    const preview = legacyRecords.slice(0, 50);
    console.log("[verify-secrets] legacy/plaintext records (max 50):");
    console.table(preview);
    if (legacyRecords.length > preview.length) {
      console.log(
        `[verify-secrets] ... +${legacyRecords.length - preview.length} additional legacy record(s).`,
      );
    }

    throw new Error("Legacy/plaintext secret kayitlari bulundu.");
  }

  console.log("[verify-secrets] PASS: Tespit edilen legacy/plaintext secret kaydi yok.");
}

main().catch((error) => {
  const safeMessage = error instanceof Error ? error.message : String(error);
  console.error(`[verify-secrets] FAIL: ${safeMessage}`);
  process.exitCode = 1;
});
