"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { SalesLeadSource } from "@prisma/client";
import {
  buttonClasses,
  fieldClasses,
  labelClasses,
  selectClasses,
  textareaClasses,
} from "@/lib/ui/button-variants";
import { createSalesLeadAction } from "@/modules/hq/actions/sales-leads";
import { getSalesLeadSourceLabel } from "@/modules/hq/server/lead-status";

type LeadCreateFormProps = {
  sources: SalesLeadSource[];
};

type FormState = {
  ok: boolean;
  message: string;
  leadId?: number;
};

const INITIAL_STATE: FormState = {
  ok: false,
  message: "",
};

export function LeadCreateForm({ sources }: LeadCreateFormProps) {
  const [state, action, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result = await createSalesLeadAction(formData);
      return {
        ok: result.success,
        message: result.message,
        leadId: result.success ? result.leadId : undefined,
      };
    },
    INITIAL_STATE,
  );

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className={labelClasses()}>Isletme Adi</label>
          <input
            name="businessName"
            required
            className={fieldClasses()}
            placeholder="Akdeniz Mutfak"
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Iletisim Kisisi</label>
          <input
            name="contactName"
            required
            className={fieldClasses()}
            placeholder="Ahmet Yilmaz"
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Telefon</label>
          <input name="phone" className={fieldClasses()} placeholder="+90 5xx xxx xx xx" />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>E-posta</label>
          <input name="email" className={fieldClasses()} placeholder="iletisim@ornek.com" />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Sehir</label>
          <input name="city" className={fieldClasses()} placeholder="Istanbul" />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Kaynak</label>
          <select name="source" className={selectClasses()} defaultValue="MANUAL">
            {sources.map((source) => (
              <option key={source} value={source}>
                {getSalesLeadSourceLabel(source)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className={labelClasses()}>Atanan (opsiyonel)</label>
          <input name="assignedTo" className={fieldClasses()} placeholder="hq-admin" />
        </div>
        <div className="space-y-1 md:col-span-2">
          <label className={labelClasses()}>Notlar (opsiyonel)</label>
          <textarea
            name="notes"
            className={textareaClasses({ className: "min-h-[88px]" })}
            placeholder="Ilk gorusme notlari..."
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={isPending} className={buttonClasses({ variant: "primary" })}>
          {isPending ? "Kaydediliyor..." : "Lead Kaydet"}
        </button>
        {state.leadId ? (
          <Link href={`/hq/leads/${state.leadId}`} className={buttonClasses({ variant: "outline" })}>
            Lead Detayina Git
          </Link>
        ) : null}
      </div>

      {state.message ? (
        <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
