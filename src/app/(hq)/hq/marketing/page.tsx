import Link from "next/link";
import { cardClasses } from "@/lib/ui/button-variants";
import { getHqMarketingOverview } from "@/modules/hq/server/marketing-queries";

function formatCount(value: number) {
  return new Intl.NumberFormat("tr-TR").format(value);
}

export default async function HqMarketingOverviewPage() {
  const { site, stats } = await getHqMarketingOverview();

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
          Landing / Marketing
        </p>
        <h2 className="mt-1 text-xl font-semibold text-[var(--ui-text-primary)]">Ana sayfa ve başvurular</h2>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
          Public ana sayfa metinleri ve düzen <code className="rounded bg-[var(--ui-surface-subtle)] px-1 py-0.5 text-xs">src/content/landing.ts</code> dosyasından yayınlanır. Aşağıdaki istatistikler lead formu ve başvuru kayıtlarını gösterir.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className={cardClasses({ className: "p-4" })}>
          <p className="text-xs text-[var(--ui-text-secondary)]">Toplam Başvuru</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--ui-text-primary)]">
            {formatCount(stats.totalSubmissions)}
          </p>
        </article>
        <article className={cardClasses({ className: "p-4" })}>
          <p className="text-xs text-[var(--ui-text-secondary)]">Lead Üretilen</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">{formatCount(stats.createdLeads)}</p>
        </article>
        <article className={cardClasses({ className: "p-4" })}>
          <p className="text-xs text-[var(--ui-text-secondary)]">Lead Bağlanamayan</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">
            {formatCount(stats.failedLeadCreates)}
          </p>
        </article>
        <article className={cardClasses({ className: "p-4" })}>
          <p className="text-xs text-[var(--ui-text-secondary)]">Son 24 Saat Başvuru</p>
          <p className="mt-2 text-2xl font-semibold text-sky-700">{formatCount(stats.todaySubmissions)}</p>
        </article>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <p className="text-sm text-[var(--ui-text-secondary)]">
          Veritabanı kaydı (lead formu için):{" "}
          <span className="font-semibold text-[var(--ui-text-primary)]">{site?.brandName ?? "—"}</span>
          {site?.isPublished !== undefined ? (
            <>
              {" "}
              · yayın bayrağı:{" "}
              <span className="font-semibold text-[var(--ui-text-primary)]">
                {site.isPublished ? "açık" : "kapalı"}
              </span>{" "}
              (public landing artık bu bayrağa bağlı değil)
            </>
          ) : null}
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm font-medium text-[var(--ui-accent)]">
          <Link href="/hq/marketing/submissions" className="hover:underline">
            Form başvuruları
          </Link>
          <Link href="/" className="hover:underline" target="_blank" rel="noreferrer">
            Ana sayfayı aç
          </Link>
        </div>
      </section>
    </div>
  );
}
