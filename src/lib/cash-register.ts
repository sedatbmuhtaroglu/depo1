import { Prisma, type CashMovementCategory, type CashMovementType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTurkeyDateString, getTurkeyDayRange } from "@/lib/turkey-time";

export const CASH_MOVEMENT_CATEGORY_OPTIONS: ReadonlyArray<{
  value: CashMovementCategory;
  label: string;
}> = [
  { value: "SALES_REVENUE", label: "Satış geliri" },
  { value: "SUPPLIER_PAYMENT", label: "Tedarikçi ödeme" },
  { value: "PERSONNEL_EXPENSE", label: "Personel gideri" },
  { value: "EXPENSE", label: "Masraf" },
  { value: "CASH_ADJUSTMENT", label: "Kasa düzeltme" },
  { value: "OTHER", label: "Diğer" },
];

export const CASH_MOVEMENT_TYPE_OPTIONS: ReadonlyArray<{
  value: CashMovementType;
  label: string;
}> = [
  { value: "IN", label: "Nakit giriş" },
  { value: "OUT", label: "Nakit çıkış" },
];

export type CashMovementListItem = {
  id: number;
  occurredAt: Date;
  type: CashMovementType;
  category: CashMovementCategory;
  note: string | null;
  amount: Prisma.Decimal;
  isVoided: boolean;
  createdAt: Date;
  actorDisplayName: string | null;
  actorUsername: string | null;
};

export type CashRegisterSummary = {
  businessDate: string;
  openingBalance: Prisma.Decimal;
  totalIn: Prisma.Decimal;
  totalOut: Prisma.Decimal;
  currentBalance: Prisma.Decimal;
  lastMovementAt: Date | null;
  dayClosedAt: Date | null;
  countedBalance: Prisma.Decimal | null;
  variance: Prisma.Decimal | null;
  closingNote: string | null;
};

function toBusinessDateValue(businessDate: string) {
  return new Date(`${businessDate}T00:00:00.000Z`);
}

function normalizeBusinessDate(value: string | undefined) {
  if (!value) return getTurkeyDateString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Invalid businessDate format.");
  }
  const parsed = toBusinessDateValue(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid businessDate value.");
  }
  return value;
}

function decimalOrZero(value: Prisma.Decimal | null | undefined) {
  return value ?? new Prisma.Decimal(0);
}

export function decimalToNumber(value: Prisma.Decimal | number | string | null | undefined) {
  if (value == null) return 0;
  if (value instanceof Prisma.Decimal) return Number(value.toString());
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

export async function ensureCashRegisterDay(params: {
  tenantId: number;
  restaurantId: number;
  businessDate?: string;
}) {
  const businessDate = normalizeBusinessDate(params.businessDate);
  const businessDateValue = toBusinessDateValue(businessDate);

  const existing = await prisma.cashRegisterDay.findUnique({
    where: {
      tenantId_restaurantId_businessDate: {
        tenantId: params.tenantId,
        restaurantId: params.restaurantId,
        businessDate: businessDateValue,
      },
    },
  });
  if (existing) return existing;

  const previousDay = await prisma.cashRegisterDay.findFirst({
    where: {
      tenantId: params.tenantId,
      restaurantId: params.restaurantId,
      businessDate: { lt: businessDateValue },
    },
    orderBy: { businessDate: "desc" },
    select: { systemBalance: true },
  });

  const openingBalance = previousDay?.systemBalance ?? new Prisma.Decimal(0);
  return prisma.cashRegisterDay.create({
    data: {
      tenantId: params.tenantId,
      restaurantId: params.restaurantId,
      businessDate: businessDateValue,
      openingBalance,
      systemBalance: openingBalance,
    },
  });
}

export async function recomputeCashRegisterDay(params: {
  tenantId: number;
  restaurantId: number;
  businessDate?: string;
}) {
  const businessDate = normalizeBusinessDate(params.businessDate);
  const { startUtc, endUtc } = getTurkeyDayRange(businessDate);
  const day = await ensureCashRegisterDay({
    tenantId: params.tenantId,
    restaurantId: params.restaurantId,
    businessDate,
  });

  const [inAggregate, outAggregate, latestMovement] = await Promise.all([
    prisma.cashMovement.aggregate({
      where: {
        tenantId: params.tenantId,
        restaurantId: params.restaurantId,
        occurredAt: { gte: startUtc, lt: endUtc },
        isVoided: false,
        type: "IN",
      },
      _sum: { amount: true },
    }),
    prisma.cashMovement.aggregate({
      where: {
        tenantId: params.tenantId,
        restaurantId: params.restaurantId,
        occurredAt: { gte: startUtc, lt: endUtc },
        isVoided: false,
        type: "OUT",
      },
      _sum: { amount: true },
    }),
    prisma.cashMovement.findFirst({
      where: {
        tenantId: params.tenantId,
        restaurantId: params.restaurantId,
        occurredAt: { gte: startUtc, lt: endUtc },
        isVoided: false,
      },
      orderBy: { occurredAt: "desc" },
      select: { occurredAt: true },
    }),
  ]);

  const totalIn = decimalOrZero(inAggregate._sum.amount);
  const totalOut = decimalOrZero(outAggregate._sum.amount);
  const systemBalance = decimalOrZero(day.openingBalance).add(totalIn).sub(totalOut);
  const variance = day.countedBalance ? day.countedBalance.sub(systemBalance) : null;

  const updatedDay = await prisma.cashRegisterDay.update({
    where: { id: day.id },
    data: {
      systemBalance,
      variance,
    },
  });

  return {
    day: updatedDay,
    summary: {
      businessDate,
      openingBalance: updatedDay.openingBalance,
      totalIn,
      totalOut,
      currentBalance: systemBalance,
      lastMovementAt: latestMovement?.occurredAt ?? null,
      dayClosedAt: updatedDay.closedAt,
      countedBalance: updatedDay.countedBalance,
      variance: updatedDay.variance,
      closingNote: updatedDay.closingNote,
    } satisfies CashRegisterSummary,
  };
}

export async function getCashRegisterDashboardData(params: {
  tenantId: number;
  restaurantId: number;
  businessDate?: string;
}) {
  const businessDate = normalizeBusinessDate(params.businessDate);
  const { startUtc, endUtc } = getTurkeyDayRange(businessDate);

  const [{ summary }, movements] = await Promise.all([
    recomputeCashRegisterDay(params),
    prisma.cashMovement.findMany({
      where: {
        tenantId: params.tenantId,
        restaurantId: params.restaurantId,
        occurredAt: { gte: startUtc, lt: endUtc },
      },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      include: {
        createdByUser: {
          select: {
            displayName: true,
            username: true,
          },
        },
      },
    }),
  ]);

  return {
    summary,
    movements: movements.map((movement) => ({
      id: movement.id,
      occurredAt: movement.occurredAt,
      type: movement.type,
      category: movement.category,
      note: movement.note,
      amount: movement.amount,
      isVoided: movement.isVoided,
      createdAt: movement.createdAt,
      actorDisplayName: movement.createdByUser?.displayName ?? null,
      actorUsername: movement.createdByUser?.username ?? null,
    })) satisfies CashMovementListItem[],
  };
}
