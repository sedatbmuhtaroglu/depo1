"use client";

import { useActionState } from "react";
import {
  buttonClasses,
  fieldClasses,
  labelClasses,
  selectClasses,
  textareaClasses,
} from "@/lib/ui/button-variants";
import { upsertLeadCommercialRecordAction } from "@/modules/hq/actions/commercial-records";

type CommercialRecordLike = {
  saleType: "DIRECT_PURCHASE" | "TRIAL_CONVERSION";
  planCode: string | null;
  packageName: string | null;
  currency: string;
  listPrice: string;
  discountAmount: string;
  netSaleAmount: string;
  operationalStatus: "DRAFT" | "WON" | "CANCELLED";
  paymentMethodSummary: string | null;
  dueDate: Date | null;
  soldAt: Date;
  salespersonName: string | null;
  notes: string | null;
};

type LeadCommercialRecordFormProps = {
  leadId?: number | null;
  tenantId?: number | null;
  currentRecord: CommercialRecordLike | null;
};

type FormState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: FormState = {
  ok: false,
  message: "",
};

function toDateInputValue(value: Date | null | undefined): string {
  if (!value) return "";
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toDateTimeLocalValue(value: Date | null | undefined): string {
  if (!value) return "";
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hour = String(value.getHours()).padStart(2, "0");
  const minute = String(value.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function LeadCommercialRecordForm({
  leadId,
  tenantId,
  currentRecord,
}: LeadCommercialRecordFormProps) {
  const [state, action, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result = await upsertLeadCommercialRecordAction(formData);
      return {
        ok: result.success,
        message: result.message,
      };
    },
    INITIAL_STATE,
  );

  return (
    <form action={action} className="space-y-3">
      {leadId ? <input type="hidden" name="leadId" value={leadId} /> : null}
      {tenantId ? <input type="hidden" name="tenantId" value={tenantId} /> : null}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className={labelClasses()}>Satis Tipi</label>
          <select
            name="saleType"
            className={selectClasses()}
            defaultValue={currentRecord?.saleType ?? "DIRECT_PURCHASE"}
          >
            <option value="DIRECT_PURCHASE">DIRECT_PURCHASE</option>
            <option value="TRIAL_CONVERSION">TRIAL_CONVERSION</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Operasyonel Durum</label>
          <select
            name="operationalStatus"
            className={selectClasses()}
            defaultValue={currentRecord?.operationalStatus ?? "WON"}
          >
            <option value="DRAFT">DRAFT</option>
            <option value="WON">WON</option>
            <option value="CANCELLED">CANCELLED</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Plan Kodu (opsiyonel)</label>
          <select name="planCode" className={selectClasses()} defaultValue={currentRecord?.planCode ?? ""}>
            <option value="">Secili Degil</option>
            <option value="MINI">MINI</option>
            <option value="RESTAURANT">RESTAURANT</option>
            <option value="CORPORATE">CORPORATE</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Paket Adi (opsiyonel)</label>
          <input
            name="packageName"
            className={fieldClasses()}
            defaultValue={currentRecord?.packageName ?? ""}
            placeholder="Yillik Restoran Paketi"
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Para Birimi</label>
          <input
            name="currency"
            required
            maxLength={3}
            className={fieldClasses()}
            defaultValue={currentRecord?.currency ?? "TRY"}
            placeholder="TRY"
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Satis Tarihi</label>
          <input
            name="soldAt"
            type="datetime-local"
            required
            className={fieldClasses()}
            defaultValue={toDateTimeLocalValue(currentRecord?.soldAt ?? new Date())}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Liste Fiyati</label>
          <input
            name="listPrice"
            type="number"
            min="0"
            step="0.01"
            required
            className={fieldClasses()}
            defaultValue={currentRecord?.listPrice ?? "0.00"}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Indirim Tutari</label>
          <input
            name="discountAmount"
            type="number"
            min="0"
            step="0.01"
            required
            className={fieldClasses()}
            defaultValue={currentRecord?.discountAmount ?? "0.00"}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Net Satis Tutari</label>
          <input
            name="netSaleAmount"
            type="number"
            min="0.01"
            step="0.01"
            required
            className={fieldClasses()}
            defaultValue={currentRecord?.netSaleAmount ?? "0.00"}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Vade Tarihi (opsiyonel)</label>
          <input
            name="dueDate"
            type="date"
            className={fieldClasses()}
            defaultValue={toDateInputValue(currentRecord?.dueDate)}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Satis Sorumlusu (opsiyonel)</label>
          <input
            name="salespersonName"
            className={fieldClasses()}
            defaultValue={currentRecord?.salespersonName ?? ""}
            placeholder="Seda K."
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Odeme Ozeti (opsiyonel)</label>
          <input
            name="paymentMethodSummary"
            className={fieldClasses()}
            defaultValue={currentRecord?.paymentMethodSummary ?? ""}
            placeholder="Havale + kart (2 taksit)"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label className={labelClasses()}>Not (opsiyonel)</label>
        <textarea
          name="notes"
          className={textareaClasses({ className: "min-h-[92px]" })}
          defaultValue={currentRecord?.notes ?? ""}
          placeholder="Operasyon notu"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={buttonClasses({ variant: "primary" })} disabled={isPending}>
          {isPending ? "Kaydediliyor..." : currentRecord ? "Ticari Kaydi Guncelle" : "Satis Kaydi Olustur"}
        </button>
      </div>

      {state.message ? (
        <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
