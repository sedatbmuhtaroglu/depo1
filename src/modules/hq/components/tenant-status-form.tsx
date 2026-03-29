"use client";

import { useActionState } from "react";
import { buttonClasses, selectClasses } from "@/lib/ui/button-variants";
import { updateTenantStatusAction } from "@/modules/hq/actions/tenant-status";
import {
  isTenantLifecycleTransitionAllowed,
  type LifecycleTransitionTarget,
} from "@/modules/hq/server/tenant-status";
import type { TenantLifecycleStatus } from "@/core/tenancy/lifecycle-policy";

type TenantStatusFormProps = {
  tenantId: number;
  currentLifecycleStatus: TenantLifecycleStatus;
};

type StatusFormState = {
  message: string;
  ok: boolean;
};

const INITIAL_STATE: StatusFormState = {
  message: "",
  ok: false,
};

const TARGET_STATUSES: LifecycleTransitionTarget[] = [
  "TRIAL",
  "PENDING_SETUP",
  "ACTIVE",
  "PAST_DUE",
  "SUSPENDED",
];

function statusLabel(status: LifecycleTransitionTarget) {
  if (status === "ACTIVE") return "Aktif";
  if (status === "TRIAL") return "Trial";
  if (status === "PENDING_SETUP") return "Pending Setup";
  if (status === "PAST_DUE") return "Past Due";
  return "Suspend";
}

export function TenantStatusForm({
  tenantId,
  currentLifecycleStatus,
}: TenantStatusFormProps) {
  const [state, formAction, isPending] = useActionState(
    async (_prev: StatusFormState, formData: FormData) => {
      const result = await updateTenantStatusAction(formData);
      return { message: result.message, ok: result.success };
    },
    INITIAL_STATE,
  );

  const options = TARGET_STATUSES.filter((targetStatus) =>
    isTenantLifecycleTransitionAllowed({
      currentLifecycleStatus,
      targetLifecycleStatus: targetStatus,
    }),
  );

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          name="targetLifecycleStatus"
          className={selectClasses({ className: "sm:min-w-[220px]" })}
          defaultValue={options[0] ?? ""}
          disabled={isPending || options.length === 0}
        >
          {options.length === 0 ? (
            <option value="">Gecis yok</option>
          ) : (
            options.map((option) => (
              <option key={option} value={option}>
                {statusLabel(option)}
              </option>
            ))
          )}
        </select>
        <button
          type="submit"
          disabled={isPending || options.length === 0}
          className={buttonClasses({ variant: "warning", className: "sm:w-auto" })}
        >
          {isPending ? "Guncelleniyor..." : "Status Guncelle"}
        </button>
      </div>
      {state.message ? (
        <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
