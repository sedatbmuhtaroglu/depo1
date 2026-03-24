const DEFAULT_LOCALE = "tr-TR";
const DEFAULT_CURRENCY = "TRY";

const formatter = new Intl.NumberFormat(DEFAULT_LOCALE, {
  style: "currency",
  currency: DEFAULT_CURRENCY,
  minimumFractionDigits: 2,
});

type CurrencyInput = number | string | { toString(): string };

function toNumber(value: CurrencyInput): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return Number(value.toString());
}

export function formatTryCurrency(
  value: CurrencyInput,
  options?: { debug?: boolean },
): string {
  const numeric = toNumber(value);
  if (!Number.isFinite(numeric)) return "-";

  const formatted = formatter.format(numeric);
  if (options?.debug && process.env.NODE_ENV !== "production") {
    console.debug("[currency-format]", { inputAmount: numeric });
  }
  return formatted;
}
