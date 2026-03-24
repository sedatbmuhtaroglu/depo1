"use client";

import { useActionState } from "react";
import type { SalesLeadSource } from "@prisma/client";
import {
  buttonClasses,
  fieldClasses,
  labelClasses,
  selectClasses,
  textareaClasses,
} from "@/lib/ui/button-variants";
import { updateSalesLeadAction } from "@/modules/hq/actions/sales-leads";
import { getSalesLeadSourceLabel } from "@/modules/hq/server/lead-status";

type LeadUpdateFormProps = {
  lead: {
    id: number;
    businessName: string;
    contactName: string;
    phone: string | null;
    email: string | null;
    city: string | null;
    notes: string | null;
    source: SalesLeadSource;
    assignedTo: string | null;
  };
  sources: SalesLeadSource[];
};

type FormState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: FormState = {
  ok: false,
  message: "",
};

export function LeadUpdateForm({ lead, sources }: LeadUpdateFormProps) {
  const [state, action, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result = await updateSalesLeadAction(formData);
      return { ok: result.success, message: result.message };
    },
    INITIAL_STATE,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="leadId" value={lead.id} />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className={labelClasses()}>Isletme Adi</label>
          <input name="businessName" defaultValue={lead.businessName} required className={fieldClasses()} />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Iletisim Kisisi</label>
          <input name="contactName" defaultValue={lead.contactName} required className={fieldClasses()} />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Telefon</label>
          <input name="phone" defaultValue={lead.phone ?? ""} className={fieldClasses()} />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>E-posta</label>
          <input name="email" defaultValue={lead.email ?? ""} className={fieldClasses()} />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Sehir</label>
          <input name="city" defaultValue={lead.city ?? ""} className={fieldClasses()} />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Kaynak</label>
          <select name="source" defaultValue={lead.source} className={selectClasses()}>
            {sources.map((source) => (
              <option key={source} value={source}>
                {getSalesLeadSourceLabel(source)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className={labelClasses()}>Atanan</label>
          <input name="assignedTo" defaultValue={lead.assignedTo ?? ""} className={fieldClasses()} />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className={labelClasses()}>Notlar</label>
          <textarea
            name="notes"
            defaultValue={lead.notes ?? ""}
            className={textareaClasses({ className: "min-h-[90px]" })}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={isPending} className={buttonClasses({ variant: "outline" })}>
          {isPending ? "Kaydediliyor..." : "Bilgileri Guncelle"}
        </button>
      </div>
      {state.message ? (
        <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
