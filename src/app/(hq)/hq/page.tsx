import Link from "next/link";
import {
  badgeClasses,
  buttonClasses,
  cardClasses,
} from "@/lib/ui/button-variants";
import { getHqCommandCenterData } from "@/modules/hq/server/command-center-queries";
import {
  getSalesLeadSourceLabel,
  getSalesLeadStatusLabel,
} from "@/modules/hq/server/lead-status";

function formatCount(value: number) {
  return new Intl.NumberFormat("tr-TR").format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatPercent(value: number) {
  return `%${new Intl.NumberFormat("tr-TR").format(value)}`;
}

export default async function HqOverviewPage() {
  const data = await getHqCommandCenterData();

  const summaryCards = [
    {
      label: "Toplam Tenant",
      value: formatCount(data.executive.totalTenants),
      note: "Canli ve trial dahil tum hesaplar",
    },
    {
      label: "Aktif Tenant",
      value: formatCount(data.executive.activeTenants),
      note: "Operasyonda canli calisan tenantlar",
    },
    {
      label: "Trial Tenant",
      value: formatCount(data.executive.trialTenants),
      note: "Deneme surecinde olan tenantlar",
    },
    {
      label: "Yeni Lead",
      value: formatCount(data.executive.newLeadCount),
      note: "Pipeline'da ilk temas bekleyen",
    },
    {
      label: "Conversion Rate",
      value: formatPercent(data.executive.conversionRatePercent),
      note: "Trial baslatan lead -> WON",
    },
    {
      label: "Setup Eksik Trial",
      value: formatCount(data.executive.setupMissingTrialCount),
      note: "Kurulum blokaji olan aktif trial",
    },
  ];

  const salesStatusOrder = [
    "NEW",
    "CONTACTED",
    "DEMO_SCHEDULED",
    "TRIAL_STARTED",
    "WON",
    "LOST",
  ] as const;

  return (
    <div className="space-y-6 pb-2">
      <section className={cardClasses({ className: "p-6 sm:p-7" })}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ui-text-secondary)]">
              HQ Command Center
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--ui-text-primary)] sm:text-[1.7rem]">
              Satış, Trial ve Operasyon Nabzı
            </h2>
            <p className="mt-2 text-sm leading-6 text-[var(--ui-text-secondary)]">
              Lead&apos;den tenant&apos;a giden hattı tek ekranda yönetin: satış sinyali, onboarding sağlığı
              ve günlük müdahale gerektiren başlıklar.
            </p>
            <p className="mt-2 text-xs text-[var(--ui-text-secondary)]">
              Güncellendi: {formatDate(new Date())}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/hq/leads" className={buttonClasses({ variant: "primary", className: "px-4" })}>
              Lead Merkezi
            </Link>
            <Link href="/hq/tenants/new" className={buttonClasses({ variant: "outline", className: "px-4" })}>
              Yeni Tenant
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {summaryCards.map((item) => (
          <article key={item.label} className={cardClasses({ className: "p-5" })}>
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--ui-text-secondary)]">
              {item.label}
            </p>
            <p className="mt-2 text-3xl font-semibold leading-none text-[var(--ui-text-primary)]">
              {item.value}
            </p>
            <p className="mt-2 text-xs text-[var(--ui-text-secondary)]">{item.note}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <article className={cardClasses({ className: "p-5" })}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-base font-semibold text-[var(--ui-text-primary)]">Bugun Dikkat Gerekenler</h3>
            <span className={badgeClasses("warning")}>Operasyonel Oncelik</span>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <section className={cardClasses({ tone: "subtle", className: "p-3.5 shadow-none" })}>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
                Setup Blocker Olan Tenantlar
              </p>
              {data.attention.setupBlockerTenants.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--ui-text-secondary)]">Acil blocker gorunmuyor.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {data.attention.setupBlockerTenants.slice(0, 4).map((tenant) => (
                    <li key={tenant.tenantId} className="rounded-lg border border-[var(--ui-border)] px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-[var(--ui-text-primary)]">{tenant.name}</p>
                        <span className="text-xs text-[var(--ui-text-secondary)]">{tenant.completionPercent}%</span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--ui-text-secondary)]">{tenant.blocker}</p>
                      <Link
                        href={`/hq/tenants/${tenant.tenantId}`}
                        className="mt-1 inline-block text-xs font-medium text-[var(--ui-accent)] hover:underline"
                      >
                        Tenant detay
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={cardClasses({ tone: "subtle", className: "p-3.5 shadow-none" })}>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
                Bugun Gelen Leadler
              </p>
              {data.attention.newLeadsToday.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--ui-text-secondary)]">Bugun yeni lead yok.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {data.attention.newLeadsToday.slice(0, 4).map((lead) => (
                    <li key={lead.leadId} className="rounded-lg border border-[var(--ui-border)] px-3 py-2">
                      <p className="text-sm font-medium text-[var(--ui-text-primary)]">{lead.businessName}</p>
                      <p className="text-xs text-[var(--ui-text-secondary)]">{lead.contactName}</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="text-xs text-[var(--ui-text-secondary)]">{formatDate(lead.createdAt)}</p>
                        <Link
                          href={`/hq/leads/${lead.leadId}`}
                          className="text-xs font-medium text-[var(--ui-accent)] hover:underline"
                        >
                          Lead detay
                        </Link>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={cardClasses({ tone: "subtle", className: "p-3.5 shadow-none" })}>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
                Trial Basladi, Go-Live Degil
              </p>
              {data.attention.trialStartedNotGoLive.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--ui-text-secondary)]">
                  Trial tarafinda go-live bekleyen kritik hesap yok.
                </p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {data.attention.trialStartedNotGoLive.slice(0, 4).map((row) => (
                    <li key={row.leadId} className="rounded-lg border border-[var(--ui-border)] px-3 py-2">
                      <p className="text-sm font-medium text-[var(--ui-text-primary)]">{row.tenantName}</p>
                      <p className="text-xs text-[var(--ui-text-secondary)]">{row.businessName}</p>
                      <p className="mt-1 text-xs text-[var(--ui-text-secondary)]">
                        Kurulum: %{row.completionPercent}
                      </p>
                      <p className="mt-1 text-xs text-[var(--ui-text-secondary)]">
                        {row.blockers[0] ?? "Go-live kosullari tamamlanmamis."}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={cardClasses({ tone: "subtle", className: "p-3.5 shadow-none" })}>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
                Son 7 Gun WON / LOST
              </p>
              <div className="mt-2 flex items-center gap-3">
                <span className={badgeClasses("success")}>WON {data.attention.wonLostLast7Days.wonCount}</span>
                <span className={badgeClasses("danger")}>LOST {data.attention.wonLostLast7Days.lostCount}</span>
              </div>
              {data.attention.wonLostLast7Days.recentMoves.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {data.attention.wonLostLast7Days.recentMoves.slice(0, 3).map((move) => (
                    <li key={`${move.status}-${move.leadId}`} className="rounded-lg border border-[var(--ui-border)] px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium text-[var(--ui-text-primary)]">{move.businessName}</p>
                        <span className={badgeClasses(move.status === "WON" ? "success" : "danger")}>
                          {move.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--ui-text-secondary)]">{formatDate(move.movedAt)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-[var(--ui-text-secondary)]">Hareket kaydi yok.</p>
              )}
            </section>
          </div>
        </article>

        <article className={cardClasses({ className: "p-5" })}>
          <h3 className="text-base font-semibold text-[var(--ui-text-primary)]">Hizli Aksiyonlar</h3>
          <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
            En sik kullanilan HQ aksiyonlarina tek tikla gidin.
          </p>
          <div className="mt-4 space-y-2">
            <Link href="/hq/leads" className={buttonClasses({ variant: "primary", fullWidth: true, className: "justify-center" })}>
              Yeni Lead Olustur / Lead Merkezi
            </Link>
            <Link href="/hq/leads" className={buttonClasses({ variant: "outline", fullWidth: true, className: "justify-center" })}>
              Leadler Ekranina Git
            </Link>
            <Link href="/hq/tenants" className={buttonClasses({ variant: "outline", fullWidth: true, className: "justify-center" })}>
              Tenantlar Ekranina Git
            </Link>
            <Link
              href="/hq/leads?status=NEW"
              className={buttonClasses({ variant: "secondary", fullWidth: true, className: "justify-center" })}
            >
              Trial Baslat (Lead Sec)
            </Link>
          </div>

          <div className={cardClasses({ tone: "subtle", className: "mt-4 p-3.5 shadow-none" })}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
              Kisa Not
            </p>
            <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
              Trial baslatma aksiyonu lead detay ekranindan yapilir. Bu buton sizi dogru filtreyle lead listesine goturur.
            </p>
          </div>
        </article>
      </section>

      <section className={cardClasses({ className: "p-5" })}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-[var(--ui-text-primary)]">Sales Pipeline Ozeti</h3>
          <Link href="/hq/leads" className="text-sm font-medium text-[var(--ui-accent)] hover:underline">
            Tum leadleri gor
          </Link>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {salesStatusOrder.map((status) => (
            <article key={status} className={cardClasses({ tone: "subtle", className: "px-3 py-2.5 shadow-none" })}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
                {getSalesLeadStatusLabel(status)}
              </p>
              <p className="mt-1 text-xl font-semibold text-[var(--ui-text-primary)]">
                {formatCount(data.sales.statusCounts[status] ?? 0)}
              </p>
            </article>
          ))}
        </div>

        {data.sales.recentLeads.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--ui-text-secondary)]">Lead kaydi bulunamadi.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--ui-border)] text-xs uppercase tracking-wide text-[var(--ui-text-secondary)]">
                  <th className="px-3 py-2">Isletme</th>
                  <th className="px-3 py-2">Kaynak</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Tarih</th>
                  <th className="px-3 py-2">Detay</th>
                </tr>
              </thead>
              <tbody>
                {data.sales.recentLeads.map((lead) => (
                  <tr key={lead.id} className="border-b border-[var(--ui-border)]/70">
                    <td className="px-3 py-2">
                      <p className="font-medium text-[var(--ui-text-primary)]">{lead.businessName}</p>
                    </td>
                    <td className="px-3 py-2">{getSalesLeadSourceLabel(lead.source)}</td>
                    <td className="px-3 py-2">{getSalesLeadStatusLabel(lead.status)}</td>
                    <td className="px-3 py-2 text-[var(--ui-text-secondary)]">{formatDate(lead.createdAt)}</td>
                    <td className="px-3 py-2">
                      <Link href={`/hq/leads/${lead.id}`} className="text-sm font-medium text-[var(--ui-accent)] hover:underline">
                        Ac
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className={cardClasses({ className: "p-5" })}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-[var(--ui-text-primary)]">Setup / Onboarding Sagligi</h3>
          <span className="text-xs text-[var(--ui-text-secondary)]">
            Degerlendirilen tenant: {formatCount(data.setupHealth.evaluatedTenantCount)}
          </span>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <article className={cardClasses({ tone: "subtle", className: "p-3.5 shadow-none" })}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
              Blocker Olanlar
            </p>
            <p className="mt-1 text-2xl font-semibold text-[var(--ui-text-primary)]">
              {formatCount(data.setupHealth.blockerTenantCount)}
            </p>
          </article>
          <article className={cardClasses({ tone: "subtle", className: "p-3.5 shadow-none" })}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
              Go-Live Hazir
            </p>
            <p className="mt-1 text-2xl font-semibold text-[var(--ui-text-primary)]">
              {formatCount(data.setupHealth.goLiveReadyCount)}
            </p>
          </article>
          <article className={cardClasses({ tone: "subtle", className: "p-3.5 shadow-none" })}>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
              Dusuk Kurulum Yuzdesi
            </p>
            <p className="mt-1 text-2xl font-semibold text-[var(--ui-text-primary)]">
              {formatCount(data.setupHealth.lowCompletionTenants.length)}
            </p>
          </article>
        </div>

        <div className="mt-4 grid gap-3 xl:grid-cols-3">
          <article className={cardClasses({ tone: "subtle", className: "p-3.5 shadow-none" })}>
            <p className="text-sm font-semibold text-[var(--ui-text-primary)]">Kurulum Yuzdesi Dusuk Tenantlar</p>
            {data.setupHealth.lowCompletionTenants.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--ui-text-secondary)]">Kritik dusuk yuzde bulunmuyor.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {data.setupHealth.lowCompletionTenants.slice(0, 5).map((tenant) => (
                  <li key={tenant.tenantId} className="rounded-lg border border-[var(--ui-border)] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-[var(--ui-text-primary)]">{tenant.name}</p>
                      <span className="text-xs text-[var(--ui-text-secondary)]">{tenant.completionPercent}%</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--ui-text-secondary)]">
                      {tenant.blockers[0] ?? "Kurulum adimlari tamamlanmamis."}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className={cardClasses({ tone: "subtle", className: "p-3.5 shadow-none" })}>
            <p className="text-sm font-semibold text-[var(--ui-text-primary)]">Blocker Listesi</p>
            {data.setupHealth.blockerTenants.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--ui-text-secondary)]">Aktif blocker yok.</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {data.setupHealth.blockerTenants.slice(0, 5).map((tenant) => (
                  <li key={tenant.tenantId} className="rounded-lg border border-[var(--ui-border)] px-3 py-2">
                    <p className="text-sm font-medium text-[var(--ui-text-primary)]">{tenant.name}</p>
                    <p className="mt-1 text-xs text-[var(--ui-text-secondary)]">{tenant.blockers[0] ?? "-"}</p>
                    <Link
                      href={`/hq/tenants/${tenant.tenantId}`}
                      className="mt-1 inline-block text-xs font-medium text-[var(--ui-accent)] hover:underline"
                    >
                      Tenant detay
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className={cardClasses({ tone: "subtle", className: "p-3.5 shadow-none" })}>
            <p className="text-sm font-semibold text-[var(--ui-text-primary)]">Go-Live Hazir Tenantlar</p>
            {data.setupHealth.readyTenants.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--ui-text-secondary)]">
                Bu kapsamda henuz go-live hazir tenant yok.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {data.setupHealth.readyTenants.slice(0, 5).map((tenant) => (
                  <li key={tenant.tenantId} className="rounded-lg border border-[var(--ui-border)] px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium text-[var(--ui-text-primary)]">{tenant.name}</p>
                      <span className={badgeClasses("success")}>{tenant.completionPercent}%</span>
                    </div>
                    <p className="mt-1 text-xs text-[var(--ui-text-secondary)]">{tenant.slug}</p>
                  </li>
                ))}
              </ul>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}
