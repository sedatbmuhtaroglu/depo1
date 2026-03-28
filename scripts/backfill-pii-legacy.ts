import { PrismaClient } from "@prisma/client";
import { packLeadLikePii, packStaffPii } from "../src/lib/pii/pii-pack";

type BackfillModel = "salesLead" | "marketingSubmission" | "tenantStaff" | "all";

type CliOptions = {
  write: boolean;
  model: BackfillModel;
  batchSize: number;
};

function parseOptions(argv: string[]): CliOptions {
  const write = argv.includes("--write");
  const modelArg = argv.find((arg) => arg.startsWith("--model="))?.split("=")[1] ?? "all";
  const batchArg = argv.find((arg) => arg.startsWith("--batch="))?.split("=")[1];
  const model = (
    modelArg === "salesLead" ||
    modelArg === "marketingSubmission" ||
    modelArg === "tenantStaff" ||
    modelArg === "all"
      ? modelArg
      : "all"
  ) as BackfillModel;
  const batchSizeRaw = Number(batchArg ?? 200);
  const batchSize = Number.isInteger(batchSizeRaw) && batchSizeRaw > 0 ? batchSizeRaw : 200;
  return { write, model, batchSize };
}

async function backfillSalesLeads(prisma: PrismaClient, options: CliOptions) {
  let cursor = 0;
  let scanned = 0;
  let prepared = 0;
  let written = 0;

  while (true) {
    const rows = await prisma.salesLead.findMany({
      where: { id: { gt: cursor } },
      orderBy: { id: "asc" },
      take: options.batchSize,
      select: {
        id: true,
        email: true,
        phone: true,
        contactName: true,
        emailEncrypted: true,
        phoneEncrypted: true,
        contactNameEncrypted: true,
      },
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      cursor = row.id;
      scanned += 1;
      const needsBackfill =
        (!row.emailEncrypted && !!row.email) ||
        (!row.phoneEncrypted && !!row.phone) ||
        (!row.contactNameEncrypted && !!row.contactName);
      if (!needsBackfill) continue;

      prepared += 1;
      if (!options.write) continue;
      const packed = packLeadLikePii({
        email: row.email,
        phone: row.phone,
        contactName: row.contactName,
      });
      await prisma.salesLead.update({
        where: { id: row.id },
        data: {
          emailEncrypted: packed.emailEncrypted,
          emailHash: packed.emailHash,
          emailMasked: packed.emailMasked,
          phoneEncrypted: packed.phoneEncrypted,
          phoneHash: packed.phoneHash,
          phoneLast4: packed.phoneLast4,
          contactNameEncrypted: packed.contactNameEncrypted,
          contactNameHash: packed.contactNameHash,
          contactNameMasked: packed.contactNameMasked,
        },
      });
      written += 1;
    }
  }

  return { scanned, prepared, written };
}

async function backfillMarketingSubmissions(prisma: PrismaClient, options: CliOptions) {
  let cursor = 0;
  let scanned = 0;
  let prepared = 0;
  let written = 0;

  while (true) {
    const rows = await prisma.marketingFormSubmission.findMany({
      where: { id: { gt: cursor } },
      orderBy: { id: "asc" },
      take: options.batchSize,
      select: {
        id: true,
        email: true,
        phone: true,
        contactName: true,
        emailEncrypted: true,
        phoneEncrypted: true,
        contactNameEncrypted: true,
      },
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      cursor = row.id;
      scanned += 1;
      const needsBackfill =
        (!row.emailEncrypted && !!row.email) ||
        (!row.phoneEncrypted && !!row.phone) ||
        (!row.contactNameEncrypted && !!row.contactName);
      if (!needsBackfill) continue;

      prepared += 1;
      if (!options.write) continue;
      const packed = packLeadLikePii({
        email: row.email,
        phone: row.phone,
        contactName: row.contactName,
      });
      await prisma.marketingFormSubmission.update({
        where: { id: row.id },
        data: {
          emailEncrypted: packed.emailEncrypted,
          emailHash: packed.emailHash,
          emailMasked: packed.emailMasked,
          phoneEncrypted: packed.phoneEncrypted,
          phoneHash: packed.phoneHash,
          phoneLast4: packed.phoneLast4,
          contactNameEncrypted: packed.contactNameEncrypted,
          contactNameHash: packed.contactNameHash,
          contactNameMasked: packed.contactNameMasked,
        },
      });
      written += 1;
    }
  }

  return { scanned, prepared, written };
}

async function backfillTenantStaff(prisma: PrismaClient, options: CliOptions) {
  let cursor = 0;
  let scanned = 0;
  let prepared = 0;
  let written = 0;

  while (true) {
    const rows = await prisma.tenantStaff.findMany({
      where: { id: { gt: cursor } },
      orderBy: { id: "asc" },
      take: options.batchSize,
      select: {
        id: true,
        email: true,
        phone: true,
        emailEncrypted: true,
        phoneEncrypted: true,
      },
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      cursor = row.id;
      scanned += 1;
      const needsBackfill =
        (!row.emailEncrypted && !!row.email) || (!row.phoneEncrypted && !!row.phone);
      if (!needsBackfill) continue;

      prepared += 1;
      if (!options.write) continue;
      const packed = packStaffPii({
        email: row.email,
        phone: row.phone,
      });
      await prisma.tenantStaff.update({
        where: { id: row.id },
        data: {
          emailEncrypted: packed.emailEncrypted,
          emailHash: packed.emailHash,
          emailMasked: packed.emailMasked,
          phoneEncrypted: packed.phoneEncrypted,
          phoneHash: packed.phoneHash,
          phoneLast4: packed.phoneLast4,
        },
      });
      written += 1;
    }
  }

  return { scanned, prepared, written };
}

async function main() {
  const options = parseOptions(process.argv.slice(2));
  const prisma = new PrismaClient();

  try {
    const runSalesLead = options.model === "all" || options.model === "salesLead";
    const runMarketing = options.model === "all" || options.model === "marketingSubmission";
    const runStaff = options.model === "all" || options.model === "tenantStaff";

    const summary: Record<string, { scanned: number; prepared: number; written: number }> = {};

    if (runSalesLead) {
      summary.salesLead = await backfillSalesLeads(prisma, options);
    }
    if (runMarketing) {
      summary.marketingSubmission = await backfillMarketingSubmissions(prisma, options);
    }
    if (runStaff) {
      summary.tenantStaff = await backfillTenantStaff(prisma, options);
    }

    console.log(
      JSON.stringify(
        {
          mode: options.write ? "write" : "dry-run",
          batchSize: options.batchSize,
          summary,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("[pii-backfill] failed", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
