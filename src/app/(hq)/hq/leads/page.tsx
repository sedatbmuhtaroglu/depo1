import Link from "next/link";
import { cardClasses, fieldClasses, selectClasses } from "@/lib/ui/button-variants";
import { LeadCreateForm } from "@/modules/hq/components/lead-create-form";
import { LeadStatusBadge } from "@/modules/hq/components/lead-status-badge";
import {
  getHqSalesOverviewData,
  getSalesLeadFilterOptions,
  listHqLeads,
} from "@/modules/hq/server/lead-queries";
import { getSalesLeadSourceLabel, getSalesLeadStatusLabel } from "@/modules/hq/server/lead-status";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatCount(value: number) {
  return new Intl.NumberFormat("tr-TR").format(value);
}

export default async function HqLeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; source?: string }>;
}) {
  const params = await searchParams;
  const [overview, leads, filters] = await Promise.all([
    getHqSalesOverviewData(),
    listHqLeads({
      search: params.q ?? null,
      status: params.status ?? null,
      source: params.source ?? null,
    }),
    Promise.resolve(getSalesLeadFilterOptions()),
  ]);

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
              Sales Pipeline
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--ui-text-primary)]">Lead Merkezi</h2>
            <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
              Lead al, trial baslat, kurulumu izle ve musteriye donustur.
            </p>
          </div>
          <Link href="/hq" className="text-sm font-medium text-[var(--ui-accent)] hover:underline">
            HQ overview
          </Link>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className={cardClasses({ className: "p-4" })}>
          <p className="text-xs text-[var(--ui-text-secondary)]">Toplam Lead</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--ui-text-primary)]">
            {formatCount(overview.totalLeads)}
          </p>
        </article>
        <article className={cardClasses({ className: "p-4" })}>
          <p className="text-xs text-[var(--ui-text-secondary)]">Aktif Trial</p>
          <p className="mt-2 text-2xl font-semibold text-sky-700">{formatCount(overview.trialLeads)}</p>
        </article>
        <article className={cardClasses({ className: "p-4" })}>
          <p className="text-xs text-[var(--ui-text-secondary)]">Kazanilan Musteri</p>
          <p className="mt-2 text-2xl font-semibold text-emerald-700">{formatCount(overview.wonLeads)}</p>
        </article>
        <article className={cardClasses({ className: "p-4" })}>
          <p className="text-xs text-[var(--ui-text-secondary)]">Dikkat Gerektiren Trial</p>
          <p className="mt-2 text-2xl font-semibold text-amber-700">
            {formatCount(overview.trialAttentionCount)}
          </p>
        </article>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Yeni Lead Ekle</h3>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
          Website entegrasyonu olmadan, HQ icinden manuel lead kaydi acin.
        </p>
        <div className="mt-3">
          <LeadCreateForm sources={filters.sources} />
        </div>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <form className="grid gap-3 md:grid-cols-4">
          <input
            type="text"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Isletme, kisi, telefon, e-posta ara"
            className={fieldClasses()}
          />
          <select name="status" defaultValue={params.status ?? ""} className={selectClasses()}>
            <option value="">Tum statusler</option>
            {filters.statuses.map((status) => (
              <option key={status} value={status}>
                {getSalesLeadStatusLabel(status)}
              </option>
            ))}
          </select>
          <select name="source" defaultValue={params.source ?? ""} className={selectClasses()}>
            <option value="">Tum kaynaklar</option>
            {filters.sources.map((source) => (
              <option key={source} value={source}>
                {getSalesLeadSourceLabel(source)}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-xl bg-[var(--ui-accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            Filtrele
          </button>
        </form>
      </section>

      <section className={cardClasses({ className: "p-0" })}>
        {leads.length === 0 ? (
          <div className="p-6 text-sm text-[var(--ui-text-secondary)]">
            Filtreye uygun lead bulunamadi.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] text-xs uppercase tracking-wide text-[var(--ui-text-secondary)]">
                  <th className="px-4 py-3">Isletme</th>
                  <th className="px-4 py-3">Iletisim</th>
                  <th className="px-4 py-3">Kaynak</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Trial/Tenant</th>
                  <th className="px-4 py-3">Olusturma</th>
                  <th className="px-4 py-3">Detay</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => (
                  <tr key={lead.id} className="border-b border-[var(--ui-border)]/70 align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--ui-text-primary)]">{lead.businessName}</p>
                      <p className="text-xs text-[var(--ui-text-secondary)]">#{lead.id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{lead.contactName}</p>
                      <p className="text-xs text-[var(--ui-text-secondary)]">{lead.phone ?? "-"}</p>
                      <p className="text-xs text-[var(--ui-text-secondary)]">{lead.email ?? "-"}</p>
                    </td>
                    <td className="px-4 py-3">{getSalesLeadSourceLabel(lead.source)}</td>
                    <td className="px-4 py-3">
                      <LeadStatusBadge status={lead.status} />
                    </td>
                    <td className="px-4 py-3">
                      {lead.tenant ? (
                        <div>
                          <p className="font-medium text-[var(--ui-text-primary)]">{lead.tenant.slug}</p>
                          <p className="text-xs text-[var(--ui-text-secondary)]">
                            {lead.tenant.lifecycleStatus} /{" "}
                            {lead.tenant.setupCompleted ? "setup tamam" : "setup eksik"}
                          </p>
                        </div>
                      ) : (
                        <p className="text-xs text-[var(--ui-text-secondary)]">Henuz trial acilmadi</p>
                      )}
                    </td>
                    <td className="px-4 py-3">{formatDate(lead.createdAt)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/hq/leads/${lead.id}`}
                        className="font-medium text-[var(--ui-accent)] hover:underline"
                      >
                        Lead detay
                      </Link>
                    </td>
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
