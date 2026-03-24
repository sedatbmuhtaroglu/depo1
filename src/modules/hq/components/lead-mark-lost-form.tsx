"use client";

import { useActionState } from "react";
import { buttonClasses, labelClasses, textareaClasses } from "@/lib/ui/button-variants";
import { markLeadLostAction } from "@/modules/hq/actions/sales-leads";

type LeadMarkLostFormProps = {
  leadId: number;
  currentReason?: string | null;
};

type FormState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: FormState = {
  ok: false,
  message: "",
};

export function LeadMarkLostForm({ leadId, currentReason }: LeadMarkLostFormProps) {
  const [state, action, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result = await markLeadLostAction(formData);
      return { ok: result.success, message: result.message };
    },
    INITIAL_STATE,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="space-y-1">
        <label className={labelClasses()}>Kaybetme Nedeni (opsiyonel)</label>
        <textarea
          name="lostReason"
          defaultValue={currentReason ?? ""}
          className={textareaClasses({ className: "min-h-[80px]" })}
          placeholder="Butce, zamanlama, rakip tercih vb."
        />
      </div>
      <button type="submit" disabled={isPending} className={buttonClasses({ variant: "danger" })}>
        {isPending ? "Isaretleniyor..." : "Kaybedildi Olarak Isaretle"}
      </button>
      {state.message ? (
        <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
