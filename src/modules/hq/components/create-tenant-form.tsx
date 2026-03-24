"use client";

import Link from "next/link";
import { useActionState } from "react";
import { buttonClasses, fieldClasses, labelClasses, selectClasses } from "@/lib/ui/button-variants";
import { createTenantAction } from "@/modules/hq/actions/create-tenant";

type PlanOption = {
  code: string;
  name: string;
};

type CreateTenantFormProps = {
  plans: PlanOption[];
};

type FormState = {
  ok: boolean;
  message: string;
  tenantId?: number;
};

const INITIAL_STATE: FormState = {
  ok: false,
  message: "",
};

export function CreateTenantForm({ plans }: CreateTenantFormProps) {
  const [state, action, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result = await createTenantAction(formData);
      return {
        ok: result.success,
        message: result.message,
        tenantId: result.success ? result.tenantId : undefined,
      };
    },
    INITIAL_STATE,
  );

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1">
          <label className={labelClasses()}>Tenant Adi</label>
          <input name="name" required className={fieldClasses()} placeholder="Acme Restaurant Group" />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Slug</label>
          <input name="slug" required className={fieldClasses()} placeholder="acme-group" />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Plan</label>
          <select name="planCode" className={selectClasses()} defaultValue={plans[0]?.code ?? ""}>
            {plans.map((plan) => (
              <option key={plan.code} value={plan.code}>
                {plan.code} - {plan.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Baslangic Status</label>
          <select name="initialStatus" className={selectClasses()} defaultValue="PENDING_SETUP">
            <option value="PENDING_SETUP">PENDING_SETUP</option>
          </select>
          <p className="text-xs text-[var(--ui-text-secondary)]">
            Trial olusturma Lead Detail {"->"} Trial Baslat uzerinden yapilir. Direkt tenant create akisinda
            ACTIVE baslangic kapatilidir; once ticari kayit olusturulmalidir.{" "}
          </p>
          <p className="text-xs text-[var(--ui-text-secondary)]">
            Trial tenant olusturmak icin once lead olusturup Lead Detail icinden Trial Baslat
            kullanilmali.{" "}
            <Link href="/hq/leads" className="font-medium text-[var(--ui-accent)] hover:underline">
              Lead listesine git
            </Link>
            .
          </p>
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Ilk Restoran Adi (opsiyonel)</label>
          <input name="restaurantName" className={fieldClasses()} placeholder="Acme Merkez Sube" />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Primary Domain (opsiyonel)</label>
          <input name="primaryDomain" className={fieldClasses()} placeholder="acme.menu.local" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          className={buttonClasses({ variant: "primary" })}
          disabled={isPending}
        >
          {isPending ? "Olusturuluyor..." : "Tenant Olustur"}
        </button>
        {state.tenantId ? (
          <Link
            href={`/hq/tenants/${state.tenantId}`}
            className={buttonClasses({ variant: "outline" })}
          >
            Tenant Detayina Git
          </Link>
        ) : null}
      </div>

      {state.message ? (
        <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
