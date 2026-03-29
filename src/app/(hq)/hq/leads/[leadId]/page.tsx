import Link from "next/link";
import { notFound } from "next/navigation";
import { cardClasses } from "@/lib/ui/button-variants";
import { CommercialRecordPaymentForm } from "@/modules/hq/components/commercial-record-payment-form";
import { LeadConvertWonForm } from "@/modules/hq/components/lead-convert-won-form";
import { LeadCommercialRecordForm } from "@/modules/hq/components/lead-commercial-record-form";
import { LeadMarkLostForm } from "@/modules/hq/components/lead-mark-lost-form";
import { LeadStartTrialForm } from "@/modules/hq/components/lead-start-trial-form";
import { LeadStatusBadge } from "@/modules/hq/components/lead-status-badge";
import { LeadStatusForm } from "@/modules/hq/components/lead-status-form";
import { TrialManagerPasswordLinkForm } from "@/modules/hq/components/trial-manager-password-link-form";
import { LeadUpdateForm } from "@/modules/hq/components/lead-update-form";
import {
  getHqLeadDetail,
  getSalesLeadFilterOptions,
} from "@/modules/hq/server/lead-queries";
import { getSalesLeadSourceLabel } from "@/modules/hq/server/lead-status";
import { resolveAvailableTenantSlug } from "@/modules/hq/server/tenant-provisioning";
import { listActivePlans } from "@/modules/hq/server/tenant-queries";

function formatDate(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatRemainingDays(endAt: Date | null): string {
  if (!endAt) return "-";
  const msDiff = endAt.getTime() - Date.now();
  if (msDiff <= 0) return "Sure doldu";
  return `${Math.ceil(msDiff / (24 * 60 * 60 * 1000))} gun`;
}

function formatMoney(value: string, currency: string): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${value} ${currency}`;
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

function paymentStatusLabel(status: "UNPAID" | "PARTIALLY_PAID" | "PAID"): string {
  if (status === "PAID") return "PAID";
  if (status === "PARTIALLY_PAID") return "PARTIALLY_PAID";
  return "UNPAID";
}

export default async function HqLeadDetailPage({
  params,
}: {
  params: Promise<{ leadId: string }>;
}) {
  const { leadId: leadIdRaw } = await params;
  const leadId = Number(leadIdRaw);
  if (!Number.isInteger(leadId) || leadId <= 0) {
    notFound();
  }

  const [detail, filters, plans] = await Promise.all([
    getHqLeadDetail(leadId),
    Promise.resolve(getSalesLeadFilterOptions()),
    listActivePlans(),
  ]);
  if (!detail) {
    notFound();
  }

  const suggestedSlug = await resolveAvailableTenantSlug(`${detail.lead.businessName}-trial`);
  const canStartTrial = !detail.tenant && detail.lead.status !== "WON";
  const canConvertWon = Boolean(detail.tenant) && detail.lead.status !== "WON";
  const canMarkLost = detail.lead.status !== "WON";

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
              Lead Detay
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-[var(--ui-text-primary)]">
                {detail.lead.businessName}
              </h2>
              <LeadStatusBadge status={detail.lead.status} />
            </div>
            <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
              Kaynak: {getSalesLeadSourceLabel(detail.lead.source)} | Iletisim: {detail.lead.contactName}
            </p>
          </div>
          <Link href="/hq/leads" className="text-sm font-medium text-[var(--ui-accent)] hover:underline">
            Lead listesine don
          </Link>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className={cardClasses({ className: "p-4" })}>
          <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Temel Bilgiler</h3>
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--ui-text-secondary)]">Lead ID</dt>
              <dd className="font-medium">{detail.lead.id}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--ui-text-secondary)]">Telefon</dt>
              <dd className="font-medium">{detail.lead.phone ?? "-"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--ui-text-secondary)]">E-posta</dt>
              <dd className="font-medium">{detail.lead.email ?? "-"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--ui-text-secondary)]">Sehir</dt>
              <dd className="font-medium">{detail.lead.city ?? "-"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--ui-text-secondary)]">Atanan</dt>
              <dd className="font-medium">{detail.lead.assignedTo ?? "-"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--ui-text-secondary)]">Olusturma</dt>
              <dd className="font-medium">{formatDate(detail.lead.createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--ui-text-secondary)]">Guncelleme</dt>
              <dd className="font-medium">{formatDate(detail.lead.updatedAt)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--ui-text-secondary)]">Trial Baslama</dt>
              <dd className="font-medium">{formatDate(detail.lead.trialStartedAt)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--ui-text-secondary)]">Trial Bitis</dt>
              <dd className="font-medium">{formatDate(detail.lead.trialEndsAt)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--ui-text-secondary)]">Kalan Sure</dt>
              <dd className="font-medium">{formatRemainingDays(detail.lead.trialEndsAt)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--ui-text-secondary)]">Ilk Yonetici Username</dt>
              <dd className="font-medium">{detail.lead.trialAdminUsername ?? "-"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--ui-text-secondary)]">WON</dt>
              <dd className="font-medium">{formatDate(detail.lead.wonAt)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--ui-text-secondary)]">LOST</dt>
              <dd className="font-medium">{formatDate(detail.lead.lostAt)}</dd>
            </div>
          </dl>
        </article>

        <article className={cardClasses({ className: "p-4" })}>
          <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Status Yonetimi</h3>
          <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
            Trial ve WON statusleri donusum aksiyonlarindan otomatik yonetilir.
          </p>
          <div className="mt-3">
            <LeadStatusForm leadId={detail.lead.id} currentStatus={detail.lead.status} />
          </div>
        </article>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Lead Bilgilerini Duzenle</h3>
        <div className="mt-3">
          <LeadUpdateForm lead={detail.lead} sources={filters.sources} />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className={cardClasses({ className: "p-4" })}>
          <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Trial / Tenant Iliskisi</h3>
          {!detail.tenant ? (
            <p className="mt-2 text-sm text-[var(--ui-text-secondary)]">
              Bu lead icin henuz trial tenant acilmamis.
            </p>
          ) : (
            <div className="mt-3 space-y-2 text-sm">
              <p className="font-medium text-[var(--ui-text-primary)]">
                {detail.tenant.name} ({detail.tenant.slug})
              </p>
              <p className="text-[var(--ui-text-secondary)]">
                Plan: {detail.tenant.planCode} - {detail.tenant.planName}
              </p>
              <p className="text-[var(--ui-text-secondary)]">
                Lifecycle: {detail.tenant.lifecycleStatus}
              </p>
              <p className="text-[var(--ui-text-secondary)]">
                Trial bitis: {formatDate(detail.tenant.trialEndsAt)} ({formatRemainingDays(detail.tenant.trialEndsAt)})
              </p>
              <Link
                href={`/hq/tenants/${detail.tenant.id}`}
                className="text-sm font-medium text-[var(--ui-accent)] hover:underline"
              >
                Tenant detayina git
              </Link>
            </div>
          )}
        </article>

        <article className={cardClasses({ className: "p-4" })}>
          <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Onboarding Sinyali</h3>
          {!detail.setupSummary ? (
            <p className="mt-2 text-sm text-[var(--ui-text-secondary)]">
              Setup gorunumu trial tenant olustuktan sonra aktif olur.
            </p>
          ) : (
            <div className="mt-2 space-y-2 text-sm">
              <p className="font-medium">
                Kurulum: %{detail.setupSummary.completionPercent} (
                {detail.setupSummary.requiredCompletedCount}/{detail.setupSummary.requiredTotalCount})
              </p>
              <p className={detail.setupSummary.goLiveReady ? "text-emerald-700" : "text-amber-700"}>
                {detail.setupSummary.goLiveReady ? "Canliya hazir" : "Canliya hazir degil"}
              </p>
              {detail.setupSummary.blockers.length > 0 ? (
                <ul className="space-y-1 text-xs text-[var(--ui-text-secondary)]">
                  {detail.setupSummary.blockers.map((blocker) => (
                    <li key={blocker}>- {blocker}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className={cardClasses({ className: "p-4" })}>
          <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Satis Kaydi Olustur</h3>
          <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
            Trial disi tenant ACTIVE oncesi ticari kayit zorunludur.
          </p>
          <div className="mt-3">
            <LeadCommercialRecordForm
              leadId={detail.lead.id}
              currentRecord={detail.commercialRecord}
            />
          </div>
        </article>

        <article className={cardClasses({ className: "p-4" })}>
          <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Ticari Ozet</h3>
          {!detail.commercialRecord ? (
            <p className="mt-2 text-sm text-[var(--ui-text-secondary)]">
              Bu lead icin henuz ticari kayit olusturulmamis.
            </p>
          ) : (
            <div className="mt-2 space-y-4">
              <dl className="grid gap-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--ui-text-secondary)]">Satis Tipi</dt>
                  <dd className="font-medium">{detail.commercialRecord.saleType}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--ui-text-secondary)]">Paket</dt>
                  <dd className="font-medium">
                    {detail.commercialRecord.packageName ?? detail.commercialRecord.planCode ?? "-"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--ui-text-secondary)]">Net Satis</dt>
                  <dd className="font-medium">
                    {formatMoney(
                      detail.commercialRecord.netSaleAmount,
                      detail.commercialRecord.currency,
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--ui-text-secondary)]">Tahsil Edilen</dt>
                  <dd className="font-medium">
                    {formatMoney(
                      detail.commercialRecord.amountCollected,
                      detail.commercialRecord.currency,
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--ui-text-secondary)]">Kalan Bakiye</dt>
                  <dd className="font-medium">
                    {formatMoney(
                      detail.commercialRecord.remainingBalance,
                      detail.commercialRecord.currency,
                    )}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--ui-text-secondary)]">Odeme Durumu</dt>
                  <dd className="font-medium">
                    {paymentStatusLabel(detail.commercialRecord.paymentStatus)}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[var(--ui-text-secondary)]">Vade</dt>
                  <dd className="font-medium">{formatDate(detail.commercialRecord.dueDate)}</dd>
                </div>
              </dl>

              <div>
                <p className="text-sm font-medium text-[var(--ui-text-primary)]">Odeme Ekle</p>
                <div className="mt-2">
                  <CommercialRecordPaymentForm
                    commercialRecordId={detail.commercialRecord.id}
                    currency={detail.commercialRecord.currency}
                  />
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-[var(--ui-text-primary)]">Odeme Gecmisi</p>
                {detail.commercialRecord.payments.length === 0 ? (
                  <p className="mt-2 text-sm text-[var(--ui-text-secondary)]">Kayitli odeme yok.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {detail.commercialRecord.payments.map((payment) => (
                      <li
                        key={payment.id}
                        className="rounded-lg border border-[var(--ui-border)] px-3 py-2 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="font-medium text-[var(--ui-text-primary)]">
                            {formatMoney(payment.amount, payment.currency)}
                          </p>
                          <p className="text-xs text-[var(--ui-text-secondary)]">
                            {formatDate(payment.paidAt)}
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-[var(--ui-text-secondary)]">
                          Yontem: {payment.paymentMethod}
                        </p>
                        {payment.note ? (
                          <p className="mt-1 text-xs text-[var(--ui-text-secondary)]">
                            Not: {payment.note}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <article className={cardClasses({ className: "p-4 xl:col-span-2" })}>
          <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Aksiyonlar</h3>
          <div className="mt-3 space-y-4">
            {canStartTrial ? (
              <div className={cardClasses({ tone: "subtle", className: "p-3.5 shadow-none" })}>
                <p className="text-sm font-medium text-[var(--ui-text-primary)]">Trial Baslat</p>
                <p className="mt-1 text-xs text-[var(--ui-text-secondary)]">
                  Lead kaydindan dogrudan trial tenant provisioning baslatin.
                </p>
                <div className="mt-3">
                  <LeadStartTrialForm
                    leadId={detail.lead.id}
                    suggestedSlug={suggestedSlug}
                    plans={plans}
                    defaultTenantName={detail.lead.businessName}
                    defaultContactName={detail.lead.contactName}
                    defaultContactEmail={detail.lead.email}
                    defaultContactPhone={detail.lead.phone}
                  />
                </div>
              </div>
            ) : null}

            {canConvertWon ? (
              <div className={cardClasses({ tone: "subtle", className: "p-3.5 shadow-none" })}>
                <p className="text-sm font-medium text-[var(--ui-text-primary)]">Musteriye Donustur (WON)</p>
                <p className="mt-1 text-xs text-[var(--ui-text-secondary)]">
                  Trial tenant planini secin, lifecycle ACTIVE yapin ve lead statusunu WON olarak kapatin.
                </p>
                <div className="mt-3">
                  <LeadConvertWonForm
                    leadId={detail.lead.id}
                    plans={plans}
                    currentPlanCode={detail.tenant?.planCode ?? null}
                  />
                </div>
              </div>
            ) : null}

            {detail.tenant && detail.trialManagerSetup ? (
              <div className={cardClasses({ tone: "subtle", className: "p-3.5 shadow-none" })}>
                <p className="text-sm font-medium text-[var(--ui-text-primary)]">
                  Ilk Yonetici Set Password Linki
                </p>
                <p className="mt-1 text-xs text-[var(--ui-text-secondary)]">
                  Link tek kullanimliktir. Gerektiginde yeni link olusturabilirsiniz.
                </p>
                <div className="mt-3">
                  <TrialManagerPasswordLinkForm
                    leadId={detail.lead.id}
                    managerUsername={detail.trialManagerSetup.username}
                    trialEndsAt={detail.lead.trialEndsAt}
                    latestToken={detail.trialManagerSetup.latestToken}
                  />
                </div>
              </div>
            ) : null}
          </div>
        </article>

        <article className={cardClasses({ className: "p-4" })}>
          <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Kaybedilen Lead</h3>
          {canMarkLost ? (
            <div className="mt-3">
              <LeadMarkLostForm leadId={detail.lead.id} currentReason={detail.lead.lostReason} />
            </div>
          ) : (
            <p className="mt-2 text-sm text-[var(--ui-text-secondary)]">
              WON lead kaybedildi olarak isaretlenemez.
            </p>
          )}
        </article>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Lead Aktivite Kaydi</h3>
        {detail.events.length === 0 ? (
          <p className="mt-3 text-sm text-[var(--ui-text-secondary)]">Kayitli aktivite yok.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {detail.events.map((event) => (
              <li
                key={event.id}
                className="rounded-lg border border-[var(--ui-border)] px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-medium text-[var(--ui-text-primary)]">{event.actionType}</p>
                  <p className="text-xs text-[var(--ui-text-secondary)]">{formatDate(event.createdAt)}</p>
                </div>
                <p className="mt-1 text-xs text-[var(--ui-text-secondary)]">Actor: {event.actorUsername}</p>
                {event.description ? (
                  <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">{event.description}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
