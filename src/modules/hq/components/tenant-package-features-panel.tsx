import { cardClasses, chipClasses } from "@/lib/ui/button-variants";
import {
  formatLimitValue,
  formatFeatureEnabled,
} from "@/modules/hq/server/tenant-package-feature-labels";
import {
  getFeatureEffectiveLabel,
  getFeatureOverrideStateLabel,
  type TenantPackageFeaturesView,
} from "@/modules/hq/server/tenant-package-features";

type TenantPackageFeaturesPanelProps = {
  data: TenantPackageFeaturesView;
};

function statusTone(value: boolean) {
  return value ? "success" : "danger";
}

function overrideTone(value: "DEFAULT" | "ENABLED" | "DISABLED") {
  if (value === "ENABLED") return "success";
  if (value === "DISABLED") return "danger";
  return "neutral";
}

export function TenantPackageFeaturesPanel({ data }: TenantPackageFeaturesPanelProps) {
  return (
    <section className={cardClasses({ className: "space-y-4 p-4" })}>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Paket Ozellikleri</h3>
        <p className="text-sm text-[var(--ui-text-secondary)]">
          Plan tanimi + tenant override + lifecycle etkisi tek gorunumde.
        </p>
      </div>

      <article className="rounded-lg border border-[var(--ui-border)] p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
          Ust Ozet
        </p>
        <dl className="mt-2 grid gap-2 text-sm md:grid-cols-2">
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--ui-text-secondary)]">Aktif Paket</dt>
            <dd className="font-medium text-[var(--ui-text-primary)]">{data.summary.activePlanName}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--ui-text-secondary)]">Tenant Status</dt>
            <dd className="font-medium text-[var(--ui-text-primary)]">{data.summary.tenantStatus}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--ui-text-secondary)]">Override Durumu</dt>
            <dd className="font-medium text-[var(--ui-text-primary)]">
              {data.summary.hasOverrides ? "Var" : "Yok"}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-[var(--ui-text-secondary)]">Toplam Aktif Ozellik</dt>
            <dd className="font-medium text-[var(--ui-text-primary)]">
              {data.summary.totalEffectiveFeatures}
            </dd>
          </div>
        </dl>
        {data.summary.criticalLimits.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {data.summary.criticalLimits.map((item) => (
              <span key={item.label} className={chipClasses("neutral")}>
                {item.label}: {item.text}
              </span>
            ))}
          </div>
        ) : null}
      </article>

      <article className="rounded-lg border border-[var(--ui-border)] p-3">
        <h4 className="text-sm font-semibold text-[var(--ui-text-primary)]">
          Paketten Gelen Ozellikler
        </h4>
        <div className="mt-3 space-y-3">
          {data.packageFeatures.map((group) => (
            <div key={group.key}>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
                {group.label}
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--ui-border)] text-xs uppercase tracking-wide text-[var(--ui-text-secondary)]">
                      <th className="px-2 py-2 text-left">Ozellik</th>
                      <th className="px-2 py-2 text-left">Paket</th>
                      <th className="px-2 py-2 text-left">Override</th>
                      <th className="px-2 py-2 text-left">Efektif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item) => (
                      <tr key={item.code} className="border-b border-[var(--ui-border)]/70">
                        <td className="px-2 py-2 font-medium text-[var(--ui-text-primary)]">
                          {item.label}
                        </td>
                        <td className="px-2 py-2">
                          <span className={chipClasses(statusTone(item.planEnabled))}>
                            {formatFeatureEnabled(item.planEnabled)}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <span className={chipClasses(overrideTone(item.overrideState))}>
                            {getFeatureOverrideStateLabel(item.overrideState)}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <span className={chipClasses(statusTone(item.effectiveEnabled))}>
                            {getFeatureEffectiveLabel(item.effectiveEnabled)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-lg border border-[var(--ui-border)] p-3">
        <h4 className="text-sm font-semibold text-[var(--ui-text-primary)]">Paket Limitleri</h4>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--ui-border)] text-xs uppercase tracking-wide text-[var(--ui-text-secondary)]">
                <th className="px-2 py-2 text-left">Limit</th>
                <th className="px-2 py-2 text-right">Paketten Gelen</th>
                <th className="px-2 py-2 text-right">Override</th>
                <th className="px-2 py-2 text-right">Efektif</th>
                <th className="px-2 py-2 text-right">Kullanim</th>
              </tr>
            </thead>
            <tbody>
              {data.limits.map((limit) => (
                <tr key={limit.resource} className="border-b border-[var(--ui-border)]/70">
                  <td className="px-2 py-2 font-medium text-[var(--ui-text-primary)]">{limit.label}</td>
                  <td className="px-2 py-2 text-right">{formatLimitValue(limit.planValue)}</td>
                  <td className="px-2 py-2 text-right">
                    {limit.overrideValue === undefined ? "-" : formatLimitValue(limit.overrideValue)}
                  </td>
                  <td className="px-2 py-2 text-right font-medium">{formatLimitValue(limit.effectiveValue)}</td>
                  <td className="px-2 py-2 text-right">{limit.used == null ? "-" : limit.used}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>

      <article className={cardClasses({ tone: "warning", className: "p-3" })}>
        <h4 className="text-sm font-semibold text-[var(--ui-text-primary)]">Override Edilenler</h4>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="rounded-lg border border-[var(--ui-border)] bg-white/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
              Feature Override
            </p>
            {data.overridden.features.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--ui-text-secondary)]">Feature override yok.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {data.overridden.features.map((item) => (
                  <li key={item.code} className="flex items-center justify-between gap-2">
                    <span className="text-[var(--ui-text-primary)]">{item.label}</span>
                    <span className={chipClasses(overrideTone(item.overrideState))}>
                      {getFeatureOverrideStateLabel(item.overrideState)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-lg border border-[var(--ui-border)] bg-white/70 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
              Limit Override
            </p>
            {data.overridden.limits.length === 0 ? (
              <p className="mt-2 text-sm text-[var(--ui-text-secondary)]">Limit override yok.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {data.overridden.limits.map((item) => (
                  <li key={item.resource} className="flex items-center justify-between gap-2">
                    <span className="text-[var(--ui-text-primary)]">{item.label}</span>
                    <span className={chipClasses("warning")}>
                      {item.overrideValue === undefined ? "-" : formatLimitValue(item.overrideValue)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-[var(--ui-border)] bg-white/80 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
            Paketten Farklilasan Alanlar
          </p>
          {data.overridden.differsFromPackage.features.length === 0 &&
          data.overridden.differsFromPackage.limits.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--ui-text-secondary)]">
              Paket ile birebir uyumlu (farkli efektif sonuc yok).
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap gap-2">
              {data.overridden.differsFromPackage.features.map((item) => (
                <span key={item.code} className={chipClasses("danger")}>
                  {item.shortLabel}: {getFeatureEffectiveLabel(item.effectiveEnabled)}
                </span>
              ))}
              {data.overridden.differsFromPackage.limits.map((item) => (
                <span key={item.resource} className={chipClasses("warning")}>
                  {item.shortLabel}: {formatLimitValue(item.effectiveValue)}
                </span>
              ))}
            </div>
          )}
        </div>
      </article>

      <article className="rounded-lg border border-[var(--ui-border)] p-3">
        <h4 className="text-sm font-semibold text-[var(--ui-text-primary)]">Efektif Sonuc</h4>
        <div className="mt-3 space-y-3">
          {data.effective.featuresByGroup.map((group) => (
            <div key={group.key}>
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
                {group.label}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {group.items.map((item) => (
                  <span
                    key={`effective-${item.code}`}
                    className={chipClasses(item.effectiveEnabled ? "success" : "neutral")}
                  >
                    {item.shortLabel}: {getFeatureEffectiveLabel(item.effectiveEnabled)}
                    {item.lifecycleLocked ? " (Kilitli)" : ""}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
