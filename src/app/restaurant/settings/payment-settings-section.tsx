"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { CreditCard } from "lucide-react";
import { saveIyzicoConfig } from "@/app/actions/save-payment-config";
import { savePaymentMethods } from "@/app/actions/payment-settings";
import { buttonClasses, cardClasses, fieldClasses, labelClasses } from "@/lib/ui/button-variants";

type IyzicoConfig = {
  apiKey: string | null;
  secretKeySet: boolean;
  isSandbox: boolean;
  isActive: boolean;
};

type PaymentMethodSettings = {
  cashActive: boolean;
  creditCardActive: boolean;
};

type Props = {
  iyzico: IyzicoConfig | null;
  paymentMethods: PaymentMethodSettings;
};

export default function PaymentSettingsSection({
  iyzico,
  paymentMethods,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [apiKey, setApiKey] = useState(iyzico?.apiKey ?? "");
  const [secretKey, setSecretKey] = useState("");
  const [isSandbox, setIsSandbox] = useState(iyzico?.isSandbox ?? true);
  const [isIyzicoConfigActive, setIsIyzicoConfigActive] = useState(
    iyzico?.isActive ?? false,
  );
  const [cashActive, setCashActive] = useState(paymentMethods.cashActive);
  const [creditCardMethodActive, setCreditCardMethodActive] = useState(
    paymentMethods.creditCardActive,
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const [configResult, methodsResult] = await Promise.all([
        saveIyzicoConfig({
          apiKey: apiKey.trim(),
          secretKey: secretKey.trim() || undefined,
          isSandbox,
          isActive: isIyzicoConfigActive,
        }),
        savePaymentMethods({
          cashActive,
          creditCardActive: creditCardMethodActive,
        }),
      ]);

      if (!configResult.success) {
        toast.error(configResult.message ?? "IyziCo ayarları kaydedilemedi.");
        return;
      }
      if (!methodsResult.success) {
        toast.error(methodsResult.message ?? "Ödeme yöntemleri kaydedilemedi.");
        return;
      }

      toast.success("Ödeme ayarları kaydedildi.");
      router.refresh();
    });
  };

  const fieldMd = fieldClasses({ size: "md", className: "text-sm" });
  const checkClass =
    "h-4 w-4 shrink-0 rounded border-[color:var(--ui-field-border)] text-[color:var(--ui-primary)] focus:ring-[color:var(--ui-field-focus-ring)]";

  return (
    <div className={cardClasses({ className: "p-5 shadow-none" })}>
      <h3 className="mb-5 flex items-center gap-2 text-base font-semibold text-[color:var(--ui-text-primary)]">
        <CreditCard className="h-5 w-5 text-[color:var(--ui-text-muted)]" />
        Ödeme ayarları
      </h3>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="rounded-xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] p-4">
          <h4 className="mb-3 text-sm font-semibold text-[color:var(--ui-text-primary)]">
            Müşteri ödeme yöntemleri
          </h4>
          <div className="grid gap-2">
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-bg)] px-3 py-2.5">
              <span className="text-sm text-[color:var(--ui-text-primary)]">Nakit ödeme</span>
              <input
                type="checkbox"
                checked={cashActive}
                onChange={(e) => setCashActive(e.target.checked)}
                className={checkClass}
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-bg)] px-3 py-2.5">
              <span className="text-sm text-[color:var(--ui-text-primary)]">Kredi kartı ile ödeme</span>
              <input
                type="checkbox"
                checked={creditCardMethodActive}
                onChange={(e) => setCreditCardMethodActive(e.target.checked)}
                className={checkClass}
              />
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-[color:var(--ui-text-primary)]">IyziCo (Kart ile ödeme)</span>
            <label className="flex cursor-pointer items-center gap-2">
              <span className="text-sm text-[color:var(--ui-text-secondary)]">Konfigürasyon aktif</span>
              <input
                type="checkbox"
                checked={isIyzicoConfigActive}
                onChange={(e) => setIsIyzicoConfigActive(e.target.checked)}
                className={checkClass}
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-1">
            <div>
              <label htmlFor="iyzico-api-key" className={labelClasses("mb-1.5")}>
                API Key
              </label>
              <input
                id="iyzico-api-key"
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="IyziCo API Key"
                className={fieldMd}
              />
            </div>
            <div>
              <label htmlFor="iyzico-secret" className={labelClasses("mb-1.5")}>
                Secret Key
              </label>
              <input
                id="iyzico-secret"
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder={
                  iyzico?.secretKeySet
                    ? "Değiştirmek için yeni değer girin"
                    : "IyziCo Secret Key"
                }
                autoComplete="off"
                className={fieldMd}
              />
              {iyzico?.secretKeySet && (
                <p className="mt-1.5 text-xs text-[color:var(--ui-text-muted)]">
                  Mevcut secret key kayıtlı. Değiştirmek için yeni değer girebilirsiniz.
                </p>
              )}
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={isSandbox}
                onChange={(e) => setIsSandbox(e.target.checked)}
                className={checkClass}
              />
              <span className="text-sm font-medium text-[color:var(--ui-text-primary)]">Test modu (sandbox)</span>
            </label>
            <p className="text-xs text-[color:var(--ui-text-muted)]">
              Test modu açıkken IyziCo sandbox ortamı kullanılır.
            </p>
          </div>
        </div>

        <div className="flex justify-end border-t border-[color:var(--ui-border-subtle)] pt-4">
          <button
            type="submit"
            disabled={isPending}
            className={buttonClasses({
              variant: "primary",
              size: "md",
              className: "min-w-[120px]",
            })}
          >
            {isPending ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}
