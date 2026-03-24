"use client";

import { useMemo } from "react";
import { useActionState } from "react";
import type { SalesLeadStatus } from "@prisma/client";
import { buttonClasses, selectClasses } from "@/lib/ui/button-variants";
import { updateSalesLeadStatusAction } from "@/modules/hq/actions/sales-leads";
import { getEditableLeadStatuses, getSalesLeadStatusLabel } from "@/modules/hq/server/lead-status";

type LeadStatusFormProps = {
  leadId: number;
  currentStatus: SalesLeadStatus;
};

type FormState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: FormState = {
  ok: false,
  message: "",
};

export function LeadStatusForm({ leadId, currentStatus }: LeadStatusFormProps) {
  const options = useMemo(() => getEditableLeadStatuses(currentStatus), [currentStatus]);
  const [state, action, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result = await updateSalesLeadStatusAction(formData);
      return { ok: result.success, message: result.message };
    },
    INITIAL_STATE,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          name="status"
          defaultValue={options[0] ?? ""}
          className={selectClasses({ className: "sm:min-w-[220px]" })}
          disabled={isPending || options.length === 0}
        >
          {options.length === 0 ? (
            <option value="">Degisim yok</option>
          ) : (
            options.map((status) => (
              <option key={status} value={status}>
                {getSalesLeadStatusLabel(status)}
              </option>
            ))
          )}
        </select>
        <button
          type="submit"
          disabled={isPending || options.length === 0}
          className={buttonClasses({ variant: "warning" })}
        >
          {isPending ? "Guncelleniyor..." : "Status Guncelle"}
        </button>
      </div>
      {state.message ? (
        <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
