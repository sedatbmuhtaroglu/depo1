"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  buttonClasses,
  cardClasses,
  fieldClasses,
  labelClasses,
  selectClasses,
} from "@/lib/ui/button-variants";
import { startLeadTrialAction } from "@/modules/hq/actions/sales-leads";

type PlanOption = {
  id: number;
  code: string;
  name: string;
};

type LeadStartTrialFormProps = {
  leadId: number;
  suggestedSlug: string;
  plans: PlanOption[];
  defaultTenantName: string;
  defaultContactName: string;
  defaultContactEmail?: string | null;
  defaultContactPhone?: string | null;
};

type FormState = {
  ok: boolean;
  message: string;
  tenantId?: number;
  adminUsername?: string;
  setPasswordLink?: string;
  setPasswordLinkExpiresAt?: string;
  trialEndsAt?: string;
  trialDays?: 7 | 14 | 30;
};

const INITIAL_STATE: FormState = {
  ok: false,
  message: "",
};

function formatDate(value: string | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function LeadStartTrialForm({
  leadId,
  suggestedSlug,
  plans,
  defaultTenantName,
  defaultContactName,
  defaultContactEmail,
  defaultContactPhone,
}: LeadStartTrialFormProps) {
  const [copied, setCopied] = useState(false);
  const [state, action, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result = await startLeadTrialAction(formData);
      if (!result.success) {
        return {
          ok: false,
          message: result.message,
        } satisfies FormState;
      }
      return {
        ok: true,
        message: result.message,
        tenantId: result.tenantId,
        adminUsername: result.adminUsername,
        setPasswordLink: result.setPasswordLink,
        setPasswordLinkExpiresAt: result.setPasswordLinkExpiresAt,
        trialEndsAt: result.trialEndsAt,
        trialDays: result.trialDays,
      } satisfies FormState;
    },
    INITIAL_STATE,
  );

  const canCopyLink = useMemo(() => Boolean(state.setPasswordLink), [state.setPasswordLink]);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="leadId" value={leadId} />
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <label className={labelClasses()}>Tenant / Restoran Adi</label>
          <input
            name="tenantName"
            defaultValue={defaultTenantName}
            required
            className={fieldClasses()}
            placeholder="Akdeniz Mutfak"
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Tenant Slug</label>
          <input
            name="tenantSlug"
            defaultValue={suggestedSlug}
            className={fieldClasses()}
            placeholder="akdeniz-mutfak-trial"
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Trial Suresi</label>
          <select name="trialDays" defaultValue="14" className={selectClasses()}>
            <option value="7">7 gun</option>
            <option value="14">14 gun</option>
            <option value="30">30 gun</option>
          </select>
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Trial Plani</label>
          <select name="planCode" defaultValue={plans[0]?.code ?? "MINI"} className={selectClasses()}>
            {plans.map((plan) => (
              <option key={plan.id} value={plan.code}>
                {plan.code} - {plan.name}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Ilk Restoran Adi (opsiyonel)</label>
          <input name="restaurantName" className={fieldClasses()} placeholder="Akdeniz Mutfak Merkez" />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Primary Domain (opsiyonel)</label>
          <input name="primaryDomain" className={fieldClasses()} placeholder="akdeniz.menu.local" />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Ilk Yonetici Adi</label>
          <input
            name="initialManagerName"
            required
            defaultValue={defaultContactName}
            className={fieldClasses()}
            placeholder="Mehmet Yilmaz"
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Ilk Yonetici Kullanici Adi</label>
          <input
            name="initialManagerUsername"
            required
            className={fieldClasses()}
            placeholder="akdeniz.manager"
            autoCapitalize="none"
            autoCorrect="off"
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Ilk Yonetici E-posta (opsiyonel)</label>
          <input
            name="initialManagerEmail"
            type="email"
            defaultValue={defaultContactEmail ?? ""}
            className={fieldClasses()}
            placeholder="yonetici@ornek.com"
          />
        </div>
        <div className="space-y-1">
          <label className={labelClasses()}>Ilk Yonetici Telefon (opsiyonel)</label>
          <input
            name="initialManagerPhone"
            defaultValue={defaultContactPhone ?? ""}
            className={fieldClasses()}
            placeholder="+90 5xx xxx xx xx"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={isPending} className={buttonClasses({ variant: "primary" })}>
          {isPending ? "Baslatiliyor..." : "Trial Baslat"}
        </button>
        {state.tenantId ? (
          <Link href={`/hq/tenants/${state.tenantId}`} className={buttonClasses({ variant: "outline" })}>
            Tenant Detayina Git
          </Link>
        ) : null}
      </div>

      {state.message ? (
        <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
      ) : null}

      {state.ok && state.setPasswordLink ? (
        <div className={cardClasses({ tone: "success", className: "space-y-2 p-3" })}>
          <p className="text-sm font-semibold text-emerald-900">Ilk Yonetici Erisim Bilgisi</p>
          <p className="text-sm text-emerald-900">Kullanici adi: {state.adminUsername}</p>
          <p className="text-sm text-emerald-900">Trial bitis: {formatDate(state.trialEndsAt)}</p>
          <p className="text-sm text-emerald-900">Link gecerlilik bitisi: {formatDate(state.setPasswordLinkExpiresAt)}</p>

          <div className="space-y-2">
            <label className={labelClasses()}>Set Password Linki</label>
            <textarea
              readOnly
              className={fieldClasses({ className: "min-h-[88px]" })}
              value={state.setPasswordLink}
            />
            <button
              type="button"
              className={buttonClasses({ variant: "outline", size: "sm" })}
              disabled={!canCopyLink}
              onClick={async () => {
                if (!state.setPasswordLink) return;
                try {
                  await navigator.clipboard.writeText(state.setPasswordLink);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1500);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Link Kopyalandi" : "Linki Kopyala"}
            </button>
          </div>
        </div>
      ) : null}
    </form>
  );
}