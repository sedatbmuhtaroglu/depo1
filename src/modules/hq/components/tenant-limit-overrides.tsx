"use client";

import { useActionState } from "react";
import { buttonClasses, fieldClasses, selectClasses } from "@/lib/ui/button-variants";
import { updateTenantLimitOverrideAction } from "@/modules/hq/actions/tenant-limits";

type LimitResource = "USERS" | "TABLES" | "MENUS" | "PRODUCTS" | "BRANCHES" | "DEVICES";

type TenantLimitOverridesProps = {
  tenantId: number;
  effectiveLimits: Record<LimitResource, number | null>;
  overrides: Array<{ resource: string; limit: number | null }>;
  usage: {
    users: number;
    tables: number;
    menus: number;
    products: number;
    restaurants: number;
  };
};

type RowState = { ok: boolean; message: string };

const RESOURCES: Array<{ code: LimitResource; label: string }> = [
  { code: "USERS", label: "Users" },
  { code: "TABLES", label: "Tables" },
  { code: "MENUS", label: "Menus" },
  { code: "PRODUCTS", label: "Products" },
  { code: "BRANCHES", label: "Branches" },
  { code: "DEVICES", label: "Devices" },
];

function formatLimit(value: number | null) {
  return value == null ? "Sinirsiz" : String(value);
}

function resolveUsed(resource: LimitResource, usage: TenantLimitOverridesProps["usage"]) {
  if (resource === "USERS") return usage.users;
  if (resource === "TABLES") return usage.tables;
  if (resource === "MENUS") return usage.menus;
  if (resource === "PRODUCTS") return usage.products;
  if (resource === "BRANCHES") return usage.restaurants;
  return null;
}

function LimitOverrideRow(props: {
  tenantId: number;
  resource: LimitResource;
  label: string;
  effectiveLimit: number | null;
  overrideLimit: number | null | undefined;
  used: number | null;
}) {
  const [state, action, isPending] = useActionState(
    async (_prev: RowState, formData: FormData) => {
      const result = await updateTenantLimitOverrideAction(formData);
      return { ok: result.success, message: result.message };
    },
    { ok: false, message: "" },
  );

  return (
    <tr className="border-b border-[var(--ui-border)]/70">
      <td className="px-2 py-2">
        <p className="font-medium">{props.label}</p>
        <p className="text-xs text-[var(--ui-text-secondary)]">{props.resource}</p>
      </td>
      <td className="px-2 py-2 text-right">{props.used == null ? "-" : props.used}</td>
      <td className="px-2 py-2 text-right">{formatLimit(props.effectiveLimit)}</td>
      <td className="px-2 py-2 text-right">
        {props.overrideLimit === undefined ? "-" : formatLimit(props.overrideLimit)}
      </td>
      <td className="px-2 py-2">
        <form action={action} className="grid gap-2 sm:grid-cols-[120px_130px_auto]">
          <input type="hidden" name="tenantId" value={props.tenantId} />
          <input type="hidden" name="resource" value={props.resource} />
          <select name="mode" defaultValue="DEFAULT" className={selectClasses({ size: "sm" })}>
            <option value="DEFAULT">Default</option>
            <option value="VALUE">Value</option>
            <option value="UNLIMITED">Unlimited</option>
          </select>
          <input
            name="limitValue"
            type="number"
            min={0}
            step={1}
            placeholder="Limit"
            className={fieldClasses({ size: "sm" })}
          />
          <button type="submit" className={buttonClasses({ variant: "outline", size: "sm" })} disabled={isPending}>
            {isPending ? "..." : "Uygula"}
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

export function TenantLimitOverrides(props: TenantLimitOverridesProps) {
  const overrideMap = new Map(props.overrides.map((row) => [row.resource, row.limit]));

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--ui-border)] text-xs uppercase tracking-wide text-[var(--ui-text-secondary)]">
            <th className="px-2 py-2 text-left">Kaynak</th>
            <th className="px-2 py-2 text-right">Used</th>
            <th className="px-2 py-2 text-right">Efektif</th>
            <th className="px-2 py-2 text-right">Override</th>
            <th className="px-2 py-2 text-left">Aksiyon</th>
          </tr>
        </thead>
        <tbody>
          {RESOURCES.map((resource) => (
            <LimitOverrideRow
              key={resource.code}
              tenantId={props.tenantId}
              resource={resource.code}
              label={resource.label}
              effectiveLimit={props.effectiveLimits[resource.code]}
              overrideLimit={overrideMap.get(resource.code)}
              used={resolveUsed(resource.code, props.usage)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
