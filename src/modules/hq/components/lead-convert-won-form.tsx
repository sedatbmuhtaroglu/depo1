"use client";

import { useActionState } from "react";
import { buttonClasses, selectClasses } from "@/lib/ui/button-variants";
import { convertTrialToWonAction } from "@/modules/hq/actions/sales-leads";

type PlanOption = {
  id: number;
  code: string;
  name: string;
};

type LeadConvertWonFormProps = {
  leadId: number;
  plans: PlanOption[];
  currentPlanCode?: string | null;
};

type FormState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: FormState = {
  ok: false,
  message: "",
};

export function LeadConvertWonForm({ leadId, plans, currentPlanCode }: LeadConvertWonFormProps) {
  const [state, action, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result = await convertTrialToWonAction(formData);
      return { ok: result.success, message: result.message };
    },
    INITIAL_STATE,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          name="planCode"
          defaultValue={currentPlanCode ?? plans[0]?.code ?? ""}
          className={selectClasses({ className: "sm:min-w-[260px]" })}
        >
          {plans.map((plan) => (
            <option key={plan.id} value={plan.code}>
              {plan.code} - {plan.name}
            </option>
          ))}
        </select>
        <button type="submit" disabled={isPending} className={buttonClasses({ variant: "success" })}>
          {isPending ? "Donusturuluyor..." : "Musteriye Donustur (WON)"}
        </button>
      </div>
      {state.message ? (
        <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
