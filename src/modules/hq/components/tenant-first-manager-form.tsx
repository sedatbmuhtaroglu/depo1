"use client";

import { useActionState, useMemo, useState } from "react";
import {
  buttonClasses,
  cardClasses,
  fieldClasses,
  labelClasses,
} from "@/lib/ui/button-variants";
import {
  createTenantFirstManagerAction,
  regenerateTenantFirstManagerPasswordLinkAction,
} from "@/modules/hq/actions/sales-leads";

type ManagerTokenInfo = {
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt: Date | null;
};

type TenantFirstManagerFormProps = {
  tenantId: number;
  trialEndsAt: Date | null;
  manager: null | {
    username: string;
    displayName: string | null;
    mustSetPassword: boolean;
    passwordInitializedAt: Date | null;
    latestToken: ManagerTokenInfo | null;
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

function tokenStatusLabel(token: ManagerTokenInfo | null): string {
  if (!token) return "Link uretilmedi";
  if (token.consumedAt) return "Kullanildi";
  if (token.revokedAt) return "Iptal edildi";
  if (token.expiresAt.getTime() <= Date.now()) return "Suresi doldu";
  return "Aktif";
}

export function TenantFirstManagerForm({
  tenantId,
  trialEndsAt,
  manager,
}: TenantFirstManagerFormProps) {
  const [copiedCreate, setCopiedCreate] = useState(false);
  const [copiedRegenerate, setCopiedRegenerate] = useState(false);

  const [createState, createAction, isCreatePending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result = await createTenantFirstManagerAction(formData);
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

  const [regenState, regenAction, isRegenPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result = await regenerateTenantFirstManagerPasswordLinkAction(formData);
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

  const canCopyCreateLink = useMemo(
    () => Boolean(createState.setPasswordLink),
    [createState.setPasswordLink],
  );
  const canCopyRegenLink = useMemo(
    () => Boolean(regenState.setPasswordLink),
    [regenState.setPasswordLink],
  );

  if (!manager) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-[var(--ui-text-secondary)]">
          Bu tenantta ilk yonetici kaydi bulunmuyor. Asagidaki formdan ilk yonetici
          olusturabilirsiniz.
        </p>
        <form action={createAction} className="space-y-3">
          <input type="hidden" name="tenantId" value={tenantId} />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <label className={labelClasses()}>Ilk Yonetici Adi</label>
              <input
                name="initialManagerName"
                required
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
                placeholder="restoran.manager"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
            <div className="space-y-1">
              <label className={labelClasses()}>Ilk Yonetici E-posta (opsiyonel)</label>
              <input
                name="initialManagerEmail"
                type="email"
                className={fieldClasses()}
                placeholder="yonetici@ornek.com"
              />
            </div>
            <div className="space-y-1">
              <label className={labelClasses()}>Ilk Yonetici Telefon (opsiyonel)</label>
              <input
                name="initialManagerPhone"
                className={fieldClasses()}
                placeholder="+90 5xx xxx xx xx"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={isCreatePending}
            className={buttonClasses({ variant: "primary" })}
          >
            {isCreatePending ? "Olusturuluyor..." : "Ilk Yonetici Olustur"}
          </button>
          {createState.message ? (
            <p
              className={`text-sm ${
                createState.ok ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {createState.message}
            </p>
          ) : null}
        </form>
        {createState.ok && createState.setPasswordLink ? (
          <div className={cardClasses({ tone: "success", className: "space-y-2 p-3" })}>
            <p className="text-sm font-semibold text-emerald-900">
              Ilk Yonetici Erisim Bilgisi
            </p>
            <p className="text-sm text-emerald-900">
              Kullanici adi: {createState.adminUsername}
            </p>
            <p className="text-sm text-emerald-900">
              Trial bitis: {formatDate(createState.trialEndsAt ?? trialEndsAt)}
            </p>
            <p className="text-sm text-emerald-900">
              Link gecerlilik bitisi: {formatDate(createState.setPasswordLinkExpiresAt)}
            </p>
            <div className="space-y-2">
              <label className={labelClasses()}>Set Password Linki</label>
              <textarea
                readOnly
                className={fieldClasses({ className: "min-h-[88px]" })}
                value={createState.setPasswordLink}
              />
              <button
                type="button"
                className={buttonClasses({ variant: "outline", size: "sm" })}
                disabled={!canCopyCreateLink}
                onClick={async () => {
                  if (!createState.setPasswordLink) return;
                  try {
                    await navigator.clipboard.writeText(createState.setPasswordLink);
                    setCopiedCreate(true);
                    window.setTimeout(() => setCopiedCreate(false), 1500);
                  } catch {
                    setCopiedCreate(false);
                  }
                }}
              >
                {copiedCreate ? "Link Kopyalandi" : "Linki Kopyala"}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className={cardClasses({ tone: "subtle", className: "space-y-2 p-3 shadow-none" })}>
        <p className="text-sm font-medium text-[var(--ui-text-primary)]">Ilk yonetici mevcut</p>
        <p className="text-sm text-[var(--ui-text-secondary)]">
          Kullanici adi: {manager.username}
        </p>
        <p className="text-sm text-[var(--ui-text-secondary)]">
          Password setup:{" "}
          {manager.mustSetPassword
            ? "Bekliyor"
            : `Tamamlandi (${formatDate(manager.passwordInitializedAt)})`}
        </p>
        <p className="text-sm text-[var(--ui-text-secondary)]">
          Link durumu: {tokenStatusLabel(manager.latestToken)}
        </p>
      </div>
      <form action={regenAction} className="space-y-2">
        <input type="hidden" name="tenantId" value={tenantId} />
        <input type="hidden" name="managerUsername" value={manager.username} />
        <button
          type="submit"
          disabled={isRegenPending}
          className={buttonClasses({ variant: "outline" })}
        >
          {isRegenPending ? "Yenileniyor..." : "Set Password Linkini Yenile"}
        </button>
        {regenState.message ? (
          <p className={`text-sm ${regenState.ok ? "text-emerald-700" : "text-rose-700"}`}>
            {regenState.message}
          </p>
        ) : null}
      </form>
      {regenState.ok && regenState.setPasswordLink ? (
        <div className={cardClasses({ tone: "success", className: "space-y-2 p-3" })}>
          <p className="text-sm text-emerald-900">Kullanici adi: {regenState.adminUsername}</p>
          <p className="text-sm text-emerald-900">
            Link gecerlilik bitisi: {formatDate(regenState.setPasswordLinkExpiresAt)}
          </p>
          <div className="space-y-2">
            <label className={labelClasses()}>Set Password Linki</label>
            <textarea
              readOnly
              value={regenState.setPasswordLink}
              className={fieldClasses({ className: "min-h-[88px]" })}
            />
            <button
              type="button"
              className={buttonClasses({ variant: "outline", size: "sm" })}
              disabled={!canCopyRegenLink}
              onClick={async () => {
                if (!regenState.setPasswordLink) return;
                try {
                  await navigator.clipboard.writeText(regenState.setPasswordLink);
                  setCopiedRegenerate(true);
                  window.setTimeout(() => setCopiedRegenerate(false), 1500);
                } catch {
                  setCopiedRegenerate(false);
                }
              }}
            >
              {copiedRegenerate ? "Link Kopyalandi" : "Linki Kopyala"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
