/**
 * Idempotent backfill: legacy plaintext PII -> encrypted + blind index columns.
 *
 *   npx ts-node -P tsconfig.scripts.json scripts/backfill-pii-fields.ts --dry-run
 *   npx ts-node -P tsconfig.scripts.json scripts/backfill-pii-fields.ts --write
 *
 * Requires: PII_ENCRYPTION_KEY_CURRENT, PII_BLIND_INDEX_KEY (or ALLOW_DEV_PII_KEYS_FALLBACK=true)
 */
import dotenv from "dotenv";
import { prisma } from "../src/lib/prisma";
import { isPiiCiphertext } from "../src/lib/pii/pii-crypto";
import { packLeadLikePii, packStaffPii } from "../src/lib/pii/pii-pack";

dotenv.config();

function parseDryRun(argv: string[]): boolean {
  return !argv.includes("--write");
}

async function main() {
  const dryRun = parseDryRun(process.argv.slice(2));

  let leadsProcessed = 0;
  let submissionsProcessed = 0;
  let staffProcessed = 0;

  const leads = await prisma.salesLead.findMany({
    where: { contactNameHash: null },
    orderBy: { id: "asc" },
    select: {
      id: true,
      email: true,
      phone: true,
      contactName: true,
      emailEncrypted: true,
    },
  });

  for (const row of leads) {
    if (row.emailEncrypted && isPiiCiphertext(row.emailEncrypted)) {
      continue;
    }
    try {
      const pii = packLeadLikePii({
        email: row.email,
        phone: row.phone,
        contactName: row.contactName,
      });
      if (!dryRun) {
        await prisma.salesLead.update({
          where: { id: row.id },
          data: { ...pii },
        });
      }
      leadsProcessed += 1;
    } catch (e) {
      console.error(`[backfill] SalesLead id=${row.id}`, e);
    }
  }

  const subs = await prisma.marketingFormSubmission.findMany({
    where: { contactNameHash: null },
    orderBy: { id: "asc" },
    select: {
      id: true,
      email: true,
      phone: true,
      contactName: true,
      emailEncrypted: true,
    },
  });

  for (const row of subs) {
    if (row.emailEncrypted && isPiiCiphertext(row.emailEncrypted)) {
      continue;
    }
    try {
      const pii = packLeadLikePii({
        email: row.email,
        phone: row.phone,
        contactName: row.contactName,
      });
      if (!dryRun) {
        await prisma.marketingFormSubmission.update({
          where: { id: row.id },
          data: { ...pii },
        });
      }
      submissionsProcessed += 1;
    } catch (e) {
      console.error(`[backfill] MarketingFormSubmission id=${row.id}`, e);
    }
  }

  const staffRows = await prisma.tenantStaff.findMany({
    where: {
      emailEncrypted: null,
      phoneEncrypted: null,
      OR: [{ email: { not: null } }, { phone: { not: null } }],
    },
    orderBy: { id: "asc" },
    select: { id: true, email: true, phone: true },
  });

  for (const row of staffRows) {
    try {
      const pii = packStaffPii({ email: row.email, phone: row.phone });
      if (!dryRun) {
        await prisma.tenantStaff.update({
          where: { id: row.id },
          data: { ...pii },
        });
      }
      staffProcessed += 1;
    } catch (e) {
      console.error(`[backfill] TenantStaff id=${row.id}`, e);
    }
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        leadsProcessed,
        submissionsProcessed,
        staffProcessed,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
