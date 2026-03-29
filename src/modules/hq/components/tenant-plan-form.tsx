"use client";

import { useActionState } from "react";
import { buttonClasses, selectClasses } from "@/lib/ui/button-variants";
import { updateTenantPlanAction } from "@/modules/hq/actions/tenant-plan";

type PlanOption = {
  code: string;
  name: string;
};

type TenantPlanFormProps = {
  tenantId: number;
  currentPlanCode: string;
  plans: PlanOption[];
};

type FormState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: FormState = { ok: false, message: "" };

export function TenantPlanForm({ tenantId, currentPlanCode, plans }: TenantPlanFormProps) {
  const [state, action, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result = await updateTenantPlanAction(formData);
      return { ok: result.success, message: result.message };
    },
    INITIAL_STATE,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <select name="planCode" className={selectClasses({ className: "sm:min-w-[260px]" })} defaultValue={currentPlanCode}>
          {plans.map((plan) => (
            <option key={plan.code} value={plan.code}>
              {plan.code} - {plan.name}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonClasses({ variant: "primary" })} disabled={isPending}>
          {isPending ? "Guncelleniyor..." : "Plani Degistir"}
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
