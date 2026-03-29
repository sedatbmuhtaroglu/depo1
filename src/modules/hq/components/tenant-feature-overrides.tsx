"use client";

import { useActionState } from "react";
import { buttonClasses, selectClasses } from "@/lib/ui/button-variants";
import { updateTenantFeatureOverrideAction } from "@/modules/hq/actions/tenant-features";
import {
  getFeatureGroupLabel,
  getFeaturePresentationByCode,
} from "@/modules/hq/server/tenant-package-feature-labels";

type FeatureOverrideRow = {
  featureCode: string;
  enabled: boolean;
};

type ManageableFeature = {
  code: string;
  name: string;
  description: string | null;
};

type TenantFeatureOverridesProps = {
  tenantId: number;
  allFeatures: ManageableFeature[];
  effectiveFeatures: string[];
  overrides: FeatureOverrideRow[];
};

type RowState = {
  ok: boolean;
  message: string;
};

function FeatureOverrideFormRow(props: {
  tenantId: number;
  feature: ManageableFeature;
  isEffectiveEnabled: boolean;
  overrideState: "DEFAULT" | "ENABLED" | "DISABLED";
}) {
  const [state, action, isPending] = useActionState(
    async (_prev: RowState, formData: FormData) => {
      const result = await updateTenantFeatureOverrideAction(formData);
      return { ok: result.success, message: result.message };
    },
    { ok: false, message: "" },
  );

  return (
    <tr className="border-b border-[var(--ui-border)]/70">
      <td className="px-2 py-2">
        <p className="font-medium">{props.feature.name}</p>
      </td>
      <td className="px-2 py-2">
        <span
          className={`text-xs font-semibold ${
            props.isEffectiveEnabled ? "text-emerald-700" : "text-rose-700"
          }`}
        >
          {props.isEffectiveEnabled ? "Açık" : "Kapalı"}
        </span>
      </td>
      <td className="px-2 py-2">
        <form action={action} className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input type="hidden" name="tenantId" value={props.tenantId} />
          <input type="hidden" name="featureCode" value={props.feature.code} />
          <select
            name="state"
            defaultValue={props.overrideState}
            className={selectClasses({ className: "min-w-[120px]" })}
          >
            <option value="DEFAULT">Varsayılan</option>
            <option value="ENABLED">Açık</option>
            <option value="DISABLED">Kapalı</option>
          </select>
          <button type="submit" className={buttonClasses({ variant: "outline", size: "sm" })} disabled={isPending}>
            {isPending ? "..." : "Kaydet"}
          </button>
        </form>
        {state.message ? (
          <p className={`mt-1 text-xs ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>
            {state.message}
          </p>
        ) : null}
      </td>
    </tr>
  );
}

export function TenantFeatureOverrides({
  tenantId,
  allFeatures,
  effectiveFeatures,
  overrides,
}: TenantFeatureOverridesProps) {
  const overrideMap = new Map(overrides.map((row) => [row.featureCode, row.enabled]));
  const effectiveSet = new Set(effectiveFeatures);
  const sortedFeatures = allFeatures
    .map((feature) => ({
      ...feature,
      presentation: getFeaturePresentationByCode({
        code: feature.code,
        fallbackName: feature.name,
      }),
    }))
    .sort((a, b) => {
      const groupCompare = getFeatureGroupLabel(a.presentation.group).localeCompare(
        getFeatureGroupLabel(b.presentation.group),
        "tr",
      );
      if (groupCompare !== 0) return groupCompare;
      return a.presentation.label.localeCompare(b.presentation.label, "tr");
    });

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--ui-border)] text-xs uppercase tracking-wide text-[var(--ui-text-secondary)]">
            <th className="px-2 py-2 text-left">Feature</th>
            <th className="px-2 py-2 text-left">Efektif</th>
            <th className="px-2 py-2 text-left">Override</th>
          </tr>
        </thead>
        <tbody>
          {sortedFeatures.map((feature) => {
            const overrideValue = overrideMap.get(feature.code);
            const overrideState =
              overrideValue == null
                ? "DEFAULT"
                : overrideValue
                  ? "ENABLED"
                  : "DISABLED";
            return (
              <FeatureOverrideFormRow
                key={feature.code}
                tenantId={tenantId}
                feature={{
                  ...feature,
                  name: feature.presentation.label,
                }}
                isEffectiveEnabled={effectiveSet.has(feature.code)}
                overrideState={overrideState}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
