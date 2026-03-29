"use client";

import { useActionState } from "react";
import {
  badgeClasses,
  buttonClasses,
  cardClasses,
  fieldClasses,
  labelClasses,
  selectClasses,
} from "@/lib/ui/button-variants";
import { updatePackageSettingsAction } from "@/modules/hq/actions/packages";
import { formatLimitValue, getLimitPresentation } from "@/modules/hq/server/tenant-package-feature-labels";
import type { HqPackageDetail } from "@/modules/hq/server/package-queries";

type HqPackageSettingsFormProps = {
  item: HqPackageDetail;
};

type FormState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: FormState = {
  ok: false,
  message: "",
};

function resolveLimitMode(value: number | null) {
  return value == null ? "UNLIMITED" : "VALUE";
}

export function HqPackageSettingsForm({ item }: HqPackageSettingsFormProps) {
  const [state, action, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result = await updatePackageSettingsAction(formData);
      return { ok: result.success, message: result.message };
    },
    INITIAL_STATE,
  );

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="planId" value={item.id} />

      <section className={cardClasses({ className: "p-4" })}>
        <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Paket Meta</h3>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <label className={labelClasses()}>Gorunen Ad</label>
            <input name="displayName" defaultValue={item.displayName} required className={fieldClasses()} />
          </div>
          <div className="space-y-1">
            <label className={labelClasses()}>Teknik Kod</label>
            <input value={item.code} disabled className={fieldClasses({ className: "opacity-80" })} />
            <p className="text-xs text-[var(--ui-text-secondary)]">
              Stabil kimlik oldugu icin degistirilemez.
            </p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-[var(--ui-text-primary)]">
            <input type="checkbox" name="isActive" value="1" defaultChecked={item.isActive} />
            Paketi aktif tut
          </label>
          <span className={badgeClasses(item.tenantCount > 0 ? "info" : "neutral")}>
            Bu paketi kullanan tenant: {item.tenantCount}
          </span>
          {!item.isActive ? (
            <span className={badgeClasses("warning")}>Pasif paket yeni tenant atamasinda gorunmez</span>
          ) : null}
        </div>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Feature Ayarlari</h3>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
          Feature matrix dogrudan paket seviyesinde acilip kapatilir.
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {item.featuresByGroup.map((group) => (
            <div key={group.key} className="rounded-lg border border-[var(--ui-border)] p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
                {group.label}
              </p>
              <div className="mt-2 space-y-2">
                {group.items.map((feature) => (
                  <label key={feature.code} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-[var(--ui-text-primary)]">{feature.label}</span>
                    <input
                      type="checkbox"
                      name="featureCodes"
                      value={feature.code}
                      defaultChecked={feature.enabled}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Limit Ayarlari</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--ui-border)] text-xs uppercase tracking-wide text-[var(--ui-text-secondary)]">
                <th className="px-2 py-2 text-left">Limit</th>
                <th className="px-2 py-2 text-right">Mevcut</th>
                <th className="px-2 py-2 text-left">Mod</th>
                <th className="px-2 py-2 text-right">Deger</th>
              </tr>
            </thead>
            <tbody>
              {item.limits.map((limit) => (
                <tr key={limit.resource} className="border-b border-[var(--ui-border)]/70">
                  <td className="px-2 py-2 font-medium text-[var(--ui-text-primary)]">{limit.label}</td>
                  <td className="px-2 py-2 text-right">{formatLimitValue(limit.value)}</td>
                  <td className="px-2 py-2">
                    <select
                      name={`limit_${limit.resource}_mode`}
                      defaultValue={resolveLimitMode(limit.value)}
                      className={selectClasses({ size: "sm" })}
                    >
                      <option value="VALUE">Deger</option>
                      <option value="UNLIMITED">Sinirsiz</option>
                    </select>
                  </td>
                  <td className="px-2 py-2 text-right">
                    <input
                      name={`limit_${limit.resource}_value`}
                      defaultValue={limit.value ?? ""}
                      type="number"
                      min={0}
                      step={1}
                      placeholder={getLimitPresentation(limit.resource).shortLabel}
                      className={fieldClasses({ size: "sm", className: "w-[140px] text-right" })}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={buttonClasses({ variant: "primary" })} disabled={isPending}>
          {isPending ? "Kaydediliyor..." : "Paket Ayarlarini Kaydet"}
        </button>
        {item.tenantCount > 0 ? (
          <span className="text-xs text-[var(--ui-text-secondary)]">
            Bu paketi kullanan tenantlarda efektif sonuclar aninda guncellenir.
          </span>
        ) : null}
      </div>

      {state.message ? (
        <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
