import Link from "next/link";
import { cardClasses } from "@/lib/ui/button-variants";
import { listHqCommercialRecords } from "@/modules/hq/server/accounting-queries";

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

export default async function HqAccountingRecordsPage() {
  const records = await listHqCommercialRecords(120);

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
              Muhasebe
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--ui-text-primary)]">
              Ticari Kayitlar
            </h2>
          </div>
          <Link href="/hq/accounting" className="text-sm font-medium text-[var(--ui-accent)] hover:underline">
            Genel bakisa don
          </Link>
        </div>
      </section>

      <section className={cardClasses({ className: "p-0" })}>
        {records.length === 0 ? (
          <div className="p-6 text-sm text-[var(--ui-text-secondary)]">Ticari kayit bulunmuyor.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] text-xs uppercase tracking-wide text-[var(--ui-text-secondary)]">
                  <th className="px-4 py-3">Kayit</th>
                  <th className="px-4 py-3">Satis</th>
                  <th className="px-4 py-3">Tahsilat</th>
                  <th className="px-4 py-3">Kalan</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Tarih</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => (
                  <tr key={record.id} className="border-b border-[var(--ui-border)]/70 align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--ui-text-primary)]">#{record.id}</p>
                      <p className="text-xs text-[var(--ui-text-secondary)]">{record.leadBusinessName}</p>
                    </td>
                    <td className="px-4 py-3">{formatMoney(record.netSaleAmount, record.currency)}</td>
                    <td className="px-4 py-3">{formatMoney(record.amountCollected, record.currency)}</td>
                    <td className="px-4 py-3">{formatMoney(record.remainingBalance, record.currency)}</td>
                    <td className="px-4 py-3">
                      <p>{record.paymentStatus}</p>
                      <p className="text-xs text-[var(--ui-text-secondary)]">{record.operationalStatus}</p>
                    </td>
                    <td className="px-4 py-3">{formatDate(record.soldAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
