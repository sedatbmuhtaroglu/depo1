import { redirect } from "next/navigation";
import { requireCashierOrManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { verifyCashReceiptToken } from "@/lib/cash-receipt-token";
import { cardClasses } from "@/lib/ui/button-variants";
import ReceiptPrintClient from "./receipt-print-client";

export const dynamic = "force-dynamic";

const METHOD_LABELS: Record<string, string> = {
  CASH: "Nakit",
  CREDIT_CARD: "Kredi Karti",
  SODEXO: "Sodexo",
  MULTINET: "Multinet",
  TICKET: "Ticket",
  METROPOL: "Metropol",
};

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(value);
}

export default async function CashReceiptPage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  await requireCashierOrManagerSession("cash.view");
  const { tenantId } = await getCurrentTenantOrThrow();
  const params = (await searchParams) ?? {};
  const token = params.token?.trim();
  if (!token) {
    redirect("/restaurant/cash");
  }

  const receipt = verifyCashReceiptToken(token);
  if (!receipt || receipt.tenantId !== tenantId) {
    redirect("/restaurant/cash");
  }

  const title =
    receipt.mode === "FULL"
      ? "Hesap Kapatma Bilgi Fisi"
      : "Kismi Tahsilat Bilgi Fisi";

  return (
    <div className="mx-auto w-full max-w-md space-y-3 py-4 print:max-w-none print:py-0">
      <section
        className={cardClasses({
          className:
            "rounded-2xl border border-[color:var(--ui-border)] bg-white p-4 text-[color:var(--ui-text-primary)] shadow-sm print:rounded-none print:border-none print:p-0 print:shadow-none",
        })}
      >
        <header className="border-b border-[color:var(--ui-border)] pb-3">
          <p className="text-center text-lg font-semibold">{title}</p>
          <p className="mt-1 text-center text-xs text-[color:var(--ui-text-secondary)]">
            {receipt.restaurantName}
          </p>
        </header>

        <div className="mt-3 space-y-1.5 text-sm">
          <p className="flex justify-between">
            <span className="text-[color:var(--ui-text-secondary)]">Masa</span>
            <span className="font-medium">Masa {receipt.tableNo}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-[color:var(--ui-text-secondary)]">Tarih</span>
            <span>{formatDateTime(receipt.issuedAtIso)}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-[color:var(--ui-text-secondary)]">Referans</span>
            <span>{receipt.reference}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-[color:var(--ui-text-secondary)]">Kasiyer</span>
            <span>{receipt.cashierName}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-[color:var(--ui-text-secondary)]">Tahsilat tipi</span>
            <span>{receipt.mode === "FULL" ? "Tam tahsilat / hesap kapatma" : "Kismi tahsilat"}</span>
          </p>
        </div>

        <div className="mt-3 border-y border-dashed border-[color:var(--ui-border)] py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
            Odeme yontemleri
          </p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {receipt.lines.map((line, index) => (
              <li key={`${receipt.receiptId}_${index}`} className="space-y-0.5">
                <div className="flex justify-between">
                  <span>{METHOD_LABELS[line.method] ?? line.method}</span>
                  <span className="font-semibold">{formatCurrency(line.amount)}</span>
                </div>
                {line.note && (
                  <p className="text-xs text-[color:var(--ui-text-secondary)]">Not: {line.note}</p>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-3 space-y-1.5 text-sm">
          <p className="flex justify-between">
            <span className="text-[color:var(--ui-text-secondary)]">Bu islemde tahsil edilen</span>
            <span className="font-semibold">{formatCurrency(receipt.transactionTotal)}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-[color:var(--ui-text-secondary)]">Islem oncesi kalan</span>
            <span>{formatCurrency(receipt.remainingBefore)}</span>
          </p>
          <p className="flex justify-between">
            <span className="text-[color:var(--ui-text-secondary)]">Islem sonrasi kalan</span>
            <span className="font-semibold">{formatCurrency(receipt.remainingAfter)}</span>
          </p>
          {receipt.mode === "FULL" ? (
            <p className="mt-1 rounded-lg bg-[color:var(--ui-surface-subtle)] px-2 py-1 text-xs font-semibold">
              Hesap kapatildi. Kalan: {formatCurrency(0)}
            </p>
          ) : (
            <p className="mt-1 rounded-lg bg-[color:var(--ui-surface-subtle)] px-2 py-1 text-xs font-semibold">
              Kismi tahsilat kaydedildi. Masa acik kalir.
            </p>
          )}
        </div>

        <p className="mt-4 border-t border-[color:var(--ui-border)] pt-3 text-xs leading-relaxed text-[color:var(--ui-text-secondary)]">
          {receipt.disclaimer}
        </p>
      </section>

      <ReceiptPrintClient autoPrint={receipt.mode === "FULL"} printKey={receipt.receiptId} />
    </div>
  );
}
