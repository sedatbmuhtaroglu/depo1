import { centsToDecimalString, decimalLikeToCents } from "@/lib/commercial-record";
import { prisma } from "@/lib/prisma";

function toMoneyString(value: { toString(): string } | number | null | undefined): string {
  if (value == null) return "0.00";
  return centsToDecimalString(decimalLikeToCents(typeof value === "number" ? value : value.toString()));
}

export type HqAccountingOverview = {
  totalCommercialRecords: number;
  totalNetSaleAmount: string;
  totalAmountCollected: string;
  totalRemainingBalance: string;
  paymentStatusCounts: {
    UNPAID: number;
    PARTIALLY_PAID: number;
    PAID: number;
  };
  recentCommercialRecords: Array<{
    id: number;
    leadId: number;
    leadBusinessName: string;
    tenantId: number | null;
    tenantName: string | null;
    saleType: "DIRECT_PURCHASE" | "TRIAL_CONVERSION";
    paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID";
    netSaleAmount: string;
    amountCollected: string;
    remainingBalance: string;
    currency: string;
    soldAt: Date;
  }>;
  recentPayments: Array<{
    id: number;
    commercialRecordId: number;
    leadBusinessName: string;
    tenantName: string | null;
    amount: string;
    currency: string;
    paymentMethod: "CASH" | "BANK_TRANSFER" | "CARD" | "OTHER";
    paidAt: Date;
  }>;
};

export async function getHqAccountingOverview(): Promise<HqAccountingOverview> {
  const [aggregate, groupedStatuses, recentCommercialRecords, recentPayments] = await Promise.all([
    prisma.commercialRecord.aggregate({
      _count: { _all: true },
      _sum: {
        netSaleAmount: true,
        amountCollected: true,
        remainingBalance: true,
      },
    }),
    prisma.commercialRecord.groupBy({
      by: ["paymentStatus"],
      _count: { _all: true },
    }),
    prisma.commercialRecord.findMany({
      orderBy: [{ soldAt: "desc" }, { id: "desc" }],
      take: 8,
      select: {
        id: true,
        leadId: true,
        saleType: true,
        paymentStatus: true,
        netSaleAmount: true,
        amountCollected: true,
        remainingBalance: true,
        currency: true,
        soldAt: true,
        lead: {
          select: {
            businessName: true,
          },
        },
        tenant: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    }),
    prisma.salePayment.findMany({
      orderBy: [{ paidAt: "desc" }, { id: "desc" }],
      take: 8,
      select: {
        id: true,
        commercialRecordId: true,
        amount: true,
        currency: true,
        paymentMethod: true,
        paidAt: true,
        commercialRecord: {
          select: {
            lead: {
              select: {
                businessName: true,
              },
            },
            tenant: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const paymentStatusCounts: HqAccountingOverview["paymentStatusCounts"] = {
    UNPAID: 0,
    PARTIALLY_PAID: 0,
    PAID: 0,
  };
  for (const row of groupedStatuses) {
    paymentStatusCounts[row.paymentStatus] = row._count._all;
  }

  return {
    totalCommercialRecords: aggregate._count._all,
    totalNetSaleAmount: toMoneyString(aggregate._sum.netSaleAmount),
    totalAmountCollected: toMoneyString(aggregate._sum.amountCollected),
    totalRemainingBalance: toMoneyString(aggregate._sum.remainingBalance),
    paymentStatusCounts,
    recentCommercialRecords: recentCommercialRecords.map((record) => ({
      id: record.id,
      leadId: record.leadId,
      leadBusinessName: record.lead.businessName,
      tenantId: record.tenant?.id ?? null,
      tenantName: record.tenant?.name ?? null,
      saleType: record.saleType,
      paymentStatus: record.paymentStatus,
      netSaleAmount: toMoneyString(record.netSaleAmount),
      amountCollected: toMoneyString(record.amountCollected),
      remainingBalance: toMoneyString(record.remainingBalance),
      currency: record.currency,
      soldAt: record.soldAt,
    })),
    recentPayments: recentPayments.map((payment) => ({
      id: payment.id,
      commercialRecordId: payment.commercialRecordId,
      leadBusinessName: payment.commercialRecord.lead.businessName,
      tenantName: payment.commercialRecord.tenant?.name ?? null,
      amount: toMoneyString(payment.amount),
      currency: payment.currency,
      paymentMethod: payment.paymentMethod,
      paidAt: payment.paidAt,
    })),
  };
}

export async function listHqCommercialRecords(limit = 100) {
  const rows = await prisma.commercialRecord.findMany({
    orderBy: [{ soldAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      leadId: true,
      saleType: true,
      paymentStatus: true,
      operationalStatus: true,
      netSaleAmount: true,
      amountCollected: true,
      remainingBalance: true,
      currency: true,
      soldAt: true,
      dueDate: true,
      lead: {
        select: { businessName: true },
      },
      tenant: {
        select: { id: true, name: true },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    leadId: row.leadId,
    leadBusinessName: row.lead.businessName,
    tenantId: row.tenant?.id ?? null,
    tenantName: row.tenant?.name ?? null,
    saleType: row.saleType,
    paymentStatus: row.paymentStatus,
    operationalStatus: row.operationalStatus,
    netSaleAmount: toMoneyString(row.netSaleAmount),
    amountCollected: toMoneyString(row.amountCollected),
    remainingBalance: toMoneyString(row.remainingBalance),
    currency: row.currency,
    soldAt: row.soldAt,
    dueDate: row.dueDate,
  }));
}

export async function listHqSalePayments(limit = 100) {
  const rows = await prisma.salePayment.findMany({
    orderBy: [{ paidAt: "desc" }, { id: "desc" }],
    take: limit,
    select: {
      id: true,
      commercialRecordId: true,
      amount: true,
      currency: true,
      paymentMethod: true,
      paidAt: true,
      note: true,
      commercialRecord: {
        select: {
          lead: {
            select: { businessName: true },
          },
          tenant: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    commercialRecordId: row.commercialRecordId,
    amount: toMoneyString(row.amount),
    currency: row.currency,
    paymentMethod: row.paymentMethod,
    paidAt: row.paidAt,
    note: row.note,
    leadBusinessName: row.commercialRecord.lead.businessName,
    tenantId: row.commercialRecord.tenant?.id ?? null,
    tenantName: row.commercialRecord.tenant?.name ?? null,
  }));
}
