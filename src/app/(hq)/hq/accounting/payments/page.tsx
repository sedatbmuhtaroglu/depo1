import Link from "next/link";
import { cardClasses } from "@/lib/ui/button-variants";
import { listHqSalePayments } from "@/modules/hq/server/accounting-queries";

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

export default async function HqAccountingPaymentsPage() {
  const payments = await listHqSalePayments(120);

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
              Muhasebe
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--ui-text-primary)]">
              Tahsilatlar
            </h2>
          </div>
          <Link href="/hq/accounting" className="text-sm font-medium text-[var(--ui-accent)] hover:underline">
            Genel bakisa don
          </Link>
        </div>
      </section>

      <section className={cardClasses({ className: "p-0" })}>
        {payments.length === 0 ? (
          <div className="p-6 text-sm text-[var(--ui-text-secondary)]">Tahsilat kaydi bulunmuyor.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] text-xs uppercase tracking-wide text-[var(--ui-text-secondary)]">
                  <th className="px-4 py-3">Odeme</th>
                  <th className="px-4 py-3">Musteri</th>
                  <th className="px-4 py-3">Yontem</th>
                  <th className="px-4 py-3">Tarih</th>
                  <th className="px-4 py-3">Not</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id} className="border-b border-[var(--ui-border)]/70 align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--ui-text-primary)]">
                        {formatMoney(payment.amount, payment.currency)}
                      </p>
                      <p className="text-xs text-[var(--ui-text-secondary)]">#{payment.id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p>{payment.leadBusinessName}</p>
                      <p className="text-xs text-[var(--ui-text-secondary)]">{payment.tenantName ?? "-"}</p>
                    </td>
                    <td className="px-4 py-3">{payment.paymentMethod}</td>
                    <td className="px-4 py-3">{formatDate(payment.paidAt)}</td>
                    <td className="px-4 py-3">{payment.note ?? "-"}</td>
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
