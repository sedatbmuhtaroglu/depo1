import Link from "next/link";
import { cardClasses } from "@/lib/ui/button-variants";
import { getHqAccountingOverview } from "@/modules/hq/server/accounting-queries";

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatMoney(value: string, currency = "TRY"): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${value} ${currency}`;
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export default async function HqAccountingPage() {
  const overview = await getHqAccountingOverview();

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
              Muhasebe
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--ui-text-primary)]">
              Muhasebe Genel Bakis
            </h2>
            <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
              Ticari kayit, tahsilat ve bakiye gorunumu.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/hq/accounting/records" className="text-sm font-medium text-[var(--ui-accent)] hover:underline">
              Ticari Kayitlar
            </Link>
            <Link href="/hq/accounting/payments" className="text-sm font-medium text-[var(--ui-accent)] hover:underline">
              Tahsilatlar
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <article className={cardClasses({ className: "p-4" })}>
          <p className="text-xs text-[var(--ui-text-secondary)]">Toplam Kayit</p>
          <p className="mt-1 text-xl font-semibold">{overview.totalCommercialRecords}</p>
        </article>
        <article className={cardClasses({ className: "p-4" })}>
          <p className="text-xs text-[var(--ui-text-secondary)]">Toplam Net Satis</p>
          <p className="mt-1 text-xl font-semibold">{formatMoney(overview.totalNetSaleAmount)}</p>
        </article>
        <article className={cardClasses({ className: "p-4" })}>
          <p className="text-xs text-[var(--ui-text-secondary)]">Toplam Tahsilat</p>
          <p className="mt-1 text-xl font-semibold">
            {formatMoney(overview.totalAmountCollected)}
          </p>
        </article>
        <article className={cardClasses({ className: "p-4" })}>
          <p className="text-xs text-[var(--ui-text-secondary)]">Toplam Kalan Bakiye</p>
          <p className="mt-1 text-xl font-semibold">
            {formatMoney(overview.totalRemainingBalance)}
          </p>
        </article>
        <article className={cardClasses({ className: "p-4" })}>
          <p className="text-xs text-[var(--ui-text-secondary)]">Odeme Dagilimi</p>
          <p className="mt-1 text-sm font-semibold">UNPAID: {overview.paymentStatusCounts.UNPAID}</p>
          <p className="text-sm font-semibold">
            PARTIALLY_PAID: {overview.paymentStatusCounts.PARTIALLY_PAID}
          </p>
          <p className="text-sm font-semibold">PAID: {overview.paymentStatusCounts.PAID}</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className={cardClasses({ className: "p-4" })}>
          <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Son Ticari Kayitlar</h3>
          {overview.recentCommercialRecords.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--ui-text-secondary)]">Kayit yok.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {overview.recentCommercialRecords.map((record) => (
                <li key={record.id} className="rounded-lg border border-[var(--ui-border)] px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-[var(--ui-text-primary)]">
                      #{record.id} - {record.leadBusinessName}
                    </p>
                    <p className="text-xs text-[var(--ui-text-secondary)]">{formatDate(record.soldAt)}</p>
                  </div>
                  <p className="mt-1 text-xs text-[var(--ui-text-secondary)]">
                    Net: {formatMoney(record.netSaleAmount, record.currency)} | Tahsilat:{" "}
                    {formatMoney(record.amountCollected, record.currency)} | Kalan:{" "}
                    {formatMoney(record.remainingBalance, record.currency)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className={cardClasses({ className: "p-4" })}>
          <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Son Tahsilatlar</h3>
          {overview.recentPayments.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--ui-text-secondary)]">Kayit yok.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {overview.recentPayments.map((payment) => (
                <li key={payment.id} className="rounded-lg border border-[var(--ui-border)] px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-[var(--ui-text-primary)]">
                      {formatMoney(payment.amount, payment.currency)}
                    </p>
                    <p className="text-xs text-[var(--ui-text-secondary)]">{formatDate(payment.paidAt)}</p>
                  </div>
                  <p className="mt-1 text-xs text-[var(--ui-text-secondary)]">
                    {payment.leadBusinessName} | {payment.paymentMethod}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </div>
  );
}
