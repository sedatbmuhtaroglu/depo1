import { Prisma } from "@prisma/client";

const MONEY_INPUT_REGEX = /^-?\d{1,12}(?:[.,]\d{1,2})?$/;
const MONEY_CENTS_LIMIT = 9_999_999_999_99;

export type CommercialPaymentState = {
  amountCollectedCents: number;
  remainingBalanceCents: number;
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID";
};

function normalizeMoneyInput(raw: string): string {
  return raw.replace(/\s+/g, "").replace(",", ".");
}

export function normalizeCommercialCurrency(raw: string | null | undefined): string | null {
  const normalized = (raw ?? "").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) return null;
  return normalized;
}

export function parseMoneyToCents(raw: FormDataEntryValue | string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return null;
    const cents = Math.round(raw * 100);
    if (Math.abs(cents) > MONEY_CENTS_LIMIT) return null;
    return cents;
  }

  const normalized = normalizeMoneyInput(raw.toString().trim());
  if (!normalized || !MONEY_INPUT_REGEX.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  const cents = Math.round(parsed * 100);
  if (Math.abs(cents) > MONEY_CENTS_LIMIT) return null;
  return cents;
}

export function centsToDecimalString(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function decimalLikeToCents(value: Prisma.Decimal | string | number): number {
  if (typeof value === "number") return Math.round(value * 100);
  return Math.round(Number(value.toString()) * 100);
}

export function resolveCommercialPaymentState(input: {
  netSaleAmountCents: number;
  amountCollectedCents: number;
}): CommercialPaymentState {
  const netSaleAmountCents = Math.max(0, input.netSaleAmountCents);
  const amountCollectedCents = Math.max(0, input.amountCollectedCents);

  if (amountCollectedCents <= 0) {
    return {
      amountCollectedCents: 0,
      remainingBalanceCents: netSaleAmountCents,
      paymentStatus: "UNPAID",
    };
  }

  if (amountCollectedCents >= netSaleAmountCents) {
    return {
      amountCollectedCents,
      remainingBalanceCents: 0,
      paymentStatus: "PAID",
    };
  }

  return {
    amountCollectedCents,
    remainingBalanceCents: netSaleAmountCents - amountCollectedCents,
    paymentStatus: "PARTIALLY_PAID",
  };
}
