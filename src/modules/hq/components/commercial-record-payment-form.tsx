"use client";

import { useActionState } from "react";
import {
  buttonClasses,
  fieldClasses,
  labelClasses,
  selectClasses,
} from "@/lib/ui/button-variants";
import { addCommercialRecordPaymentAction } from "@/modules/hq/actions/commercial-records";

type CommercialRecordPaymentFormProps = {
  commercialRecordId: number;
  currency: string;
};

type FormState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: FormState = {
  ok: false,
  message: "",
};

function toDateTimeLocalValue(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  const hour = String(value.getHours()).padStart(2, "0");
  const minute = String(value.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function CommercialRecordPaymentForm({
  commercialRecordId,
  currency,
}: CommercialRecordPaymentFormProps) {
  const [state, action, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result = await addCommercialRecordPaymentAction(formData);
      return {
        ok: result.success,
        message: result.message,
      };
    },
    INITIAL_STATE,
  );

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="commercialRecordId" value={commercialRecordId} />
      <input type="hidden" name="currency" value={currency} />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className={labelClasses()}>Odeme Tutari ({currency})</label>
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            className={fieldClasses()}
            placeholder="0.00"
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Odeme Yontemi</label>
          <select name="paymentMethod" className={selectClasses()} defaultValue="BANK_TRANSFER">
            <option value="CASH">CASH</option>
            <option value="BANK_TRANSFER">BANK_TRANSFER</option>
            <option value="CARD">CARD</option>
            <option value="OTHER">OTHER</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Odeme Tarihi</label>
          <input
            name="paidAt"
            type="datetime-local"
            required
            className={fieldClasses()}
            defaultValue={toDateTimeLocalValue(new Date())}
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Not (opsiyonel)</label>
          <input name="note" className={fieldClasses()} placeholder="Odeme aciklamasi" />
        </div>
      </div>

      <button type="submit" className={buttonClasses({ variant: "success" })} disabled={isPending}>
        {isPending ? "Ekleniyor..." : "Odeme Ekle"}
      </button>

      {state.message ? (
        <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
      ) : null}
    </form>
  );
}
