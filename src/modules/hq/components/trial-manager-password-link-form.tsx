"use client";

import { useActionState, useMemo, useState } from "react";
import { buttonClasses, cardClasses, fieldClasses, labelClasses } from "@/lib/ui/button-variants";
import { regenerateLeadTrialManagerPasswordLinkAction } from "@/modules/hq/actions/sales-leads";

type TrialManagerPasswordLinkFormProps = {
  leadId: number;
  managerUsername: string;
  trialEndsAt: Date | null;
  latestToken: null | {
    createdAt: Date;
    expiresAt: Date;
    consumedAt: Date | null;
    revokedAt: Date | null;
  };
};

type FormState = {
  ok: boolean;
  message: string;
  adminUsername?: string;
  setPasswordLink?: string;
  setPasswordLinkExpiresAt?: string;
  trialEndsAt?: string | null;
};

const INITIAL_STATE: FormState = {
  ok: false,
  message: "",
};

function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function tokenStatusLabel(token: TrialManagerPasswordLinkFormProps["latestToken"]): string {
  if (!token) return "Link uretilmedi";
  if (token.consumedAt) return "Kullanildi";
  if (token.revokedAt) return "Iptal edildi";
  if (token.expiresAt.getTime() <= Date.now()) return "Suresi doldu";
  return "Aktif";
}

export function TrialManagerPasswordLinkForm({
  leadId,
  managerUsername,
  trialEndsAt,
  latestToken,
}: TrialManagerPasswordLinkFormProps) {
  const [copied, setCopied] = useState(false);
  const [state, action, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result = await regenerateLeadTrialManagerPasswordLinkAction(formData);
      if (!result.success) {
        return { ok: false, message: result.message } satisfies FormState;
      }
      return {
        ok: true,
        message: result.message,
        adminUsername: result.adminUsername,
        setPasswordLink: result.setPasswordLink,
        setPasswordLinkExpiresAt: result.setPasswordLinkExpiresAt,
        trialEndsAt: result.trialEndsAt,
      } satisfies FormState;
    },
    INITIAL_STATE,
  );

  const canCopyLink = useMemo(() => Boolean(state.setPasswordLink), [state.setPasswordLink]);

  return (
    <div className="space-y-3">
      <div className={cardClasses({ tone: "subtle", className: "space-y-2 p-3 shadow-none" })}>
        <p className="text-sm font-medium text-[var(--ui-text-primary)]">Ilk yonetici</p>
        <p className="text-sm text-[var(--ui-text-secondary)]">Kullanici adi: {managerUsername}</p>
        <p className="text-sm text-[var(--ui-text-secondary)]">Trial bitis: {formatDate(trialEndsAt)}</p>
        <p className="text-sm text-[var(--ui-text-secondary)]">Link durumu: {tokenStatusLabel(latestToken)}</p>
        {latestToken ? (
          <p className="text-xs text-[var(--ui-text-secondary)]">
            Son link olusturma: {formatDate(latestToken.createdAt)} | gecerlilik sonu:{" "}
            {formatDate(latestToken.expiresAt)}
          </p>
        ) : null}
      </div>

      <form action={action} className="space-y-2">
        <input type="hidden" name="leadId" value={leadId} />
        <button type="submit" disabled={isPending} className={buttonClasses({ variant: "outline" })}>
          {isPending ? "Yenileniyor..." : "Set Password Linkini Yenile"}
        </button>

        {state.message ? (
          <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
        ) : null}
      </form>

      {state.ok && state.setPasswordLink ? (
        <div className={cardClasses({ tone: "success", className: "space-y-2 p-3" })}>
          <p className="text-sm text-emerald-900">Kullanici adi: {state.adminUsername}</p>
          <p className="text-sm text-emerald-900">
            Link gecerlilik bitisi: {formatDate(state.setPasswordLinkExpiresAt)}
          </p>
          <div className="space-y-2">
            <label className={labelClasses()}>Set Password Linki</label>
            <textarea readOnly value={state.setPasswordLink} className={fieldClasses({ className: "min-h-[88px]" })} />
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
    </div>
  );
}

