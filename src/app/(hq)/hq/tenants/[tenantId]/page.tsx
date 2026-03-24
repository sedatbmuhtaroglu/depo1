import { notFound } from "next/navigation";
import { cardClasses, chipClasses } from "@/lib/ui/button-variants";
import { CommercialRecordPaymentForm } from "@/modules/hq/components/commercial-record-payment-form";
import { LifecycleBadge } from "@/modules/hq/components/lifecycle-badge";
import { TenantFeatureOverrides } from "@/modules/hq/components/tenant-feature-overrides";
import { TenantLimitOverrides } from "@/modules/hq/components/tenant-limit-overrides";
import { TenantPermanentDeleteForm } from "@/modules/hq/components/tenant-permanent-delete-form";
import { TenantPlanForm } from "@/modules/hq/components/tenant-plan-form";
import { TenantStatusForm } from "@/modules/hq/components/tenant-status-form";
import { HqTenantSetupPanel } from "@/modules/onboarding/components/hq-tenant-setup-panel";
import {
  getHqTenantDetail,
  listActivePlans,
  listManageableFeatures,
} from "@/modules/hq/server/tenant-queries";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function formatNullableDate(value: Date | null): string {
  if (!value) return "-";
  return formatDate(value);
}

function formatRemainingDays(endAt: Date | null): string {
  if (!endAt) return "-";
  const msDiff = endAt.getTime() - Date.now();
  if (msDiff <= 0) return "Sure doldu";
  return `${Math.ceil(msDiff / (24 * 60 * 60 * 1000))} gun`;
}

function renderLimitValue(value: number | null) {
  if (value == null) return "Sinirsiz";
  return new Intl.NumberFormat("tr-TR").format(value);
}

function usagePercent(used: number, max: number | null): string {
  if (max == null || max <= 0) return "-";
  return `${Math.min(Math.round((used / max) * 100), 100)}%`;
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

export default async function HqTenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId: tenantIdRaw } = await params;
  const tenantId = Number(tenantIdRaw);
  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    notFound();
  }

  const [detail, plans, manageableFeatures] = await Promise.all([
    getHqTenantDetail(tenantId),
    listActivePlans(),
    listManageableFeatures(),
  ]);
  if (!detail) {
    notFound();
  }

  const effectiveFeatureList = Array.from(detail.entitlements.features).sort((a, b) =>
    a.localeCompare(b),
  );
  const limits = detail.entitlements.limits;
  const remainingCommercialBalance = detail.commercialSummary
    ? Number(detail.commercialSummary.remainingBalance)
    : 0;
  const hasCommercialRisk = detail.commercialSummary
    ? Number.isFinite(remainingCommercialBalance) && remainingCommercialBalance > 0
    : false;

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
          Tenant Detay
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold text-[var(--ui-text-primary)]">{detail.tenant.name}</h2>
          <LifecycleBadge status={detail.tenant.lifecycleStatus} />
        </div>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
          slug: {detail.tenant.slug} | plan: {detail.tenant.planCode}
        </p>
      </section>

      <HqTenantSetupPanel tenantId={detail.tenant.id} />

      <section className="grid gap-4 xl:grid-cols-2">
        <article className={cardClasses({ className: "p-4" })}>
          <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Genel Bilgiler</h3>
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--ui-text-secondary)]">Tenant ID</dt>
              <dd className="font-medium">{detail.tenant.id}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--ui-text-secondary)]">Olusturma</dt>
              <dd className="font-medium">{formatDate(detail.tenant.createdAt)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--ui-text-secondary)]">Guncelleme</dt>
              <dd className="font-medium">{formatDate(detail.tenant.updatedAt)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--ui-text-secondary)]">Raw Status</dt>
              <dd className="font-medium">{detail.tenant.statusRaw}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--ui-text-secondary)]">Kurulum Durumu</dt>
              <dd className="font-medium">
                {detail.tenant.setupCompleted ? "Tamamlandi" : "Devam Ediyor"}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--ui-text-secondary)]">Provisioning Step</dt>
              <dd className="font-medium">{detail.tenant.setupStep ?? "-"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--ui-text-secondary)]">Trial Baslangic</dt>
              <dd className="font-medium">{formatNullableDate(detail.tenant.trialStartedAt)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--ui-text-secondary)]">Trial Bitis</dt>
              <dd className="font-medium">{formatNullableDate(detail.tenant.trialEndsAt)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--ui-text-secondary)]">Kalan Trial Suresi</dt>
              <dd className="font-medium">{formatRemainingDays(detail.tenant.trialEndsAt)}</dd>
            </div>
          </dl>
        </article>

        <article className={cardClasses({ className: "p-4" })}>
          <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Status Yonetimi</h3>
          <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
            Lifecycle kurallariyla uyumlu status gecisleri.
          </p>
          <p className="mt-1 text-xs text-[var(--ui-text-secondary)]">
            Trial disi ACTIVE gecisi icin ticari kayit zorunludur.
          </p>
          <div className="mt-3">
            <TenantStatusForm
              tenantId={detail.tenant.id}
              currentLifecycleStatus={detail.tenant.lifecycleStatus}
            />
          </div>
        </article>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Plan Yonetimi</h3>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
          Mevcut plan: {detail.tenant.planCode} - {detail.tenant.planName}
        </p>
        <div className="mt-3">
          <TenantPlanForm
            tenantId={detail.tenant.id}
            currentPlanCode={detail.tenant.planCode}
            plans={plans}
          />
        </div>
      </section>

      {detail.trialLead ? (
        <section className={cardClasses({ className: "p-4" })}>
          <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Trial Yonetici Durumu</h3>
          <div className="mt-2 space-y-2 text-sm">
            <p className="text-[var(--ui-text-secondary)]">
              Lead ID: <span className="font-medium text-[var(--ui-text-primary)]">{detail.trialLead.leadId}</span>
            </p>
            <p className="text-[var(--ui-text-secondary)]">
              Ilk yonetici:{" "}
              <span className="font-medium text-[var(--ui-text-primary)]">
                {detail.trialManagerSetup?.username ?? detail.trialLead.trialAdminUsername ?? "-"}
              </span>
            </p>
            <p className="text-[var(--ui-text-secondary)]">
              Password setup:{" "}
              <span className="font-medium text-[var(--ui-text-primary)]">
                {detail.trialManagerSetup
                  ? detail.trialManagerSetup.mustSetPassword
                    ? "Bekliyor"
                    : `Tamamlandi (${formatNullableDate(detail.trialManagerSetup.passwordInitializedAt)})`
                  : "-"}
              </span>
            </p>
            <p className="text-[var(--ui-text-secondary)]">
              Son link:{" "}
              <span className="font-medium text-[var(--ui-text-primary)]">
                {detail.trialManagerSetup?.latestToken
                  ? `${formatDate(detail.trialManagerSetup.latestToken.createdAt)} / son: ${formatDate(detail.trialManagerSetup.latestToken.expiresAt)}`
                  : "Yok"}
              </span>
            </p>
          </div>
        </section>
      ) : null}

      <section className={cardClasses({ className: "p-4" })}>
        <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Ticari Ozet</h3>
        {!detail.commercialSummary ? (
          <p className="mt-2 text-sm text-[var(--ui-text-secondary)]">
            Bu tenant icin bagli bir ticari kayit bulunamadi.
          </p>
        ) : (
          <div className="mt-3 space-y-4">
            <div className="rounded-lg border border-[var(--ui-border)] px-3 py-2 text-sm">
              <p className="font-medium text-[var(--ui-text-primary)]">
                Lead #{detail.commercialSummary.leadId} - {detail.commercialSummary.leadBusinessName}
              </p>
              <p className={`mt-1 text-xs ${hasCommercialRisk ? "text-amber-700" : "text-emerald-700"}`}>
                {hasCommercialRisk
                  ? "Ticari risk: kalan bakiye mevcut."
                  : "Ticari risk: kalan bakiye yok."}
              </p>
            </div>

            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--ui-text-secondary)]">Satis Tipi</dt>
                <dd className="font-medium">{detail.commercialSummary.saleType}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--ui-text-secondary)]">Paket</dt>
                <dd className="font-medium">
                  {detail.commercialSummary.packageName ?? detail.commercialSummary.planCode ?? "-"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--ui-text-secondary)]">Net Satis</dt>
                <dd className="font-medium">
                  {formatMoney(
                    detail.commercialSummary.netSaleAmount,
                    detail.commercialSummary.currency,
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--ui-text-secondary)]">Tahsil Edilen</dt>
                <dd className="font-medium">
                  {formatMoney(
                    detail.commercialSummary.amountCollected,
                    detail.commercialSummary.currency,
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--ui-text-secondary)]">Kalan Bakiye</dt>
                <dd className="font-medium">
                  {formatMoney(
                    detail.commercialSummary.remainingBalance,
                    detail.commercialSummary.currency,
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--ui-text-secondary)]">Odeme Durumu</dt>
                <dd className="font-medium">{detail.commercialSummary.paymentStatus}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-[var(--ui-text-secondary)]">Vade Tarihi</dt>
                <dd className="font-medium">{formatNullableDate(detail.commercialSummary.dueDate)}</dd>
              </div>
            </dl>

            <div>
              <p className="text-sm font-medium text-[var(--ui-text-primary)]">Odeme Ekle</p>
              <div className="mt-2">
                <CommercialRecordPaymentForm
                  commercialRecordId={detail.commercialSummary.id}
                  currency={detail.commercialSummary.currency}
                />
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-[var(--ui-text-primary)]">Odeme Gecmisi</p>
              {detail.commercialSummary.payments.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--ui-text-secondary)]">Kayitli odeme yok.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {detail.commercialSummary.payments.map((payment) => (
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
                        <p className="mt-1 text-xs text-[var(--ui-text-secondary)]">Not: {payment.note}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className={cardClasses({ className: "p-4" })}>
          <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Entitlement Ozeti</h3>
          <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
            Efektif feature listesi (plan + override + lifecycle).
          </p>
          {effectiveFeatureList.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--ui-text-secondary)]">Acik feature yok.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {effectiveFeatureList.map((feature) => (
                <span key={feature} className={chipClasses("neutral")}>
                  {feature}
                </span>
              ))}
            </div>
          )}
        </article>

        <article className={cardClasses({ className: "p-4" })}>
          <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Limit ve Kullanim Ozeti</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--ui-border)] text-xs uppercase tracking-wide text-[var(--ui-text-secondary)]">
                  <th className="px-2 py-2 text-left">Kaynak</th>
                  <th className="px-2 py-2 text-right">Kullanim</th>
                  <th className="px-2 py-2 text-right">Efektif Limit</th>
                  <th className="px-2 py-2 text-right">Doluluk</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[var(--ui-border)]/70">
                  <td className="px-2 py-2">Users</td>
                  <td className="px-2 py-2 text-right">{detail.usage.users}</td>
                  <td className="px-2 py-2 text-right">{renderLimitValue(limits.USERS)}</td>
                  <td className="px-2 py-2 text-right">{usagePercent(detail.usage.users, limits.USERS)}</td>
                </tr>
                <tr className="border-b border-[var(--ui-border)]/70">
                  <td className="px-2 py-2">Tables</td>
                  <td className="px-2 py-2 text-right">{detail.usage.tables}</td>
                  <td className="px-2 py-2 text-right">{renderLimitValue(limits.TABLES)}</td>
                  <td className="px-2 py-2 text-right">{usagePercent(detail.usage.tables, limits.TABLES)}</td>
                </tr>
                <tr className="border-b border-[var(--ui-border)]/70">
                  <td className="px-2 py-2">Menus</td>
                  <td className="px-2 py-2 text-right">{detail.usage.menus}</td>
                  <td className="px-2 py-2 text-right">{renderLimitValue(limits.MENUS)}</td>
                  <td className="px-2 py-2 text-right">{usagePercent(detail.usage.menus, limits.MENUS)}</td>
                </tr>
                <tr className="border-b border-[var(--ui-border)]/70">
                  <td className="px-2 py-2">Products</td>
                  <td className="px-2 py-2 text-right">{detail.usage.products}</td>
                  <td className="px-2 py-2 text-right">{renderLimitValue(limits.PRODUCTS)}</td>
                  <td className="px-2 py-2 text-right">{usagePercent(detail.usage.products, limits.PRODUCTS)}</td>
                </tr>
                <tr className="border-b border-[var(--ui-border)]/70">
                  <td className="px-2 py-2">Branches</td>
                  <td className="px-2 py-2 text-right">{detail.usage.restaurants}</td>
                  <td className="px-2 py-2 text-right">{renderLimitValue(limits.BRANCHES)}</td>
                  <td className="px-2 py-2 text-right">
                    {usagePercent(detail.usage.restaurants, limits.BRANCHES)}
                  </td>
                </tr>
                <tr>
                  <td className="px-2 py-2">Devices</td>
                  <td className="px-2 py-2 text-right">-</td>
                  <td className="px-2 py-2 text-right">{renderLimitValue(limits.DEVICES)}</td>
                  <td className="px-2 py-2 text-right">-</td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Feature Yonetimi</h3>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
          Tenant bazli override (Default / Enable / Disable).
        </p>
        <div className="mt-3">
          <TenantFeatureOverrides
            tenantId={detail.tenant.id}
            allFeatures={manageableFeatures}
            effectiveFeatures={effectiveFeatureList}
            overrides={detail.featureOverrides}
          />
        </div>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Limit Override Yonetimi</h3>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
          Plan limitlerini tenant bazinda override edin.
        </p>
        <div className="mt-3">
          <TenantLimitOverrides
            tenantId={detail.tenant.id}
            effectiveLimits={detail.entitlements.limits}
            overrides={detail.limitOverrides}
            usage={detail.usage}
          />
        </div>
      </section>

      <section className={cardClasses({ tone: "danger", className: "p-4" })}>
        <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Danger Zone</h3>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
          Tenanti kalici silerseniz operasyon verileri geri getirilemez.
        </p>
        <div className="mt-3">
          <TenantPermanentDeleteForm
            tenantId={detail.tenant.id}
            tenantName={detail.tenant.name}
            tenantSlug={detail.tenant.slug}
          />
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className={cardClasses({ className: "p-4" })}>
          <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Domain / Erisim Ozeti</h3>
          {detail.domains.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--ui-text-secondary)]">
              Domain kaydi yok. Varsayilan erisim slug uzerinden saglaniyor.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {detail.domains.map((domain) => (
                <li
                  key={domain.id}
                  className="flex items-center justify-between rounded-lg border border-[var(--ui-border)] px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{domain.domain}</p>
                    <p className="text-xs text-[var(--ui-text-secondary)]">{domain.type}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs">{domain.isPrimary ? "Primary" : "Secondary"}</p>
                    <p className="text-xs text-[var(--ui-text-secondary)]">
                      {domain.isVerified ? "Verified" : "Not Verified"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className={cardClasses({ className: "p-4" })}>
          <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Audit / Not</h3>
          <p className="mt-3 text-sm text-[var(--ui-text-secondary)]">
            Bu fazda support notu ve detayli audit timeline placeholder durumunda.
            HQ control aksiyonlari audit log olarak kaydedilmektedir.
          </p>
        </article>
      </section>
    </div>
  );
}
