"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { CreditCard } from "lucide-react";
import { saveIyzicoConfig } from "@/app/actions/save-payment-config";
import { savePaymentMethods } from "@/app/actions/payment-settings";

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

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-base font-semibold text-neutral-900">
        <CreditCard className="h-5 w-5 text-neutral-500" />
        Ödeme ayarları
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4">
          <h4 className="mb-3 text-sm font-semibold text-neutral-800">
            Müşteri ödeme yöntemleri
          </h4>
          <div className="grid gap-2">
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2">
              <span className="text-sm text-neutral-700">Nakit ödeme</span>
              <input
                type="checkbox"
                checked={cashActive}
                onChange={(e) => setCashActive(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-neutral-200 bg-white px-3 py-2">
              <span className="text-sm text-neutral-700">Kredi kartı ile ödeme</span>
              <input
                type="checkbox"
                checked={creditCardMethodActive}
                onChange={(e) => setCreditCardMethodActive(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
              />
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="font-medium text-neutral-800">IyziCo (Kart ile ödeme)</span>
            <label className="flex cursor-pointer items-center gap-2">
              <span className="text-sm text-neutral-600">Konfigürasyon aktif</span>
              <input
                type="checkbox"
                checked={isIyzicoConfigActive}
                onChange={(e) => setIsIyzicoConfigActive(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-emerald-600 focus:ring-emerald-500"
              />
            </label>
          </div>
          <div className="grid gap-3 sm:grid-cols-1">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">
                API Key
              </label>
              <input
                type="text"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="IyziCo API Key"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">
                Secret Key
              </label>
              <input
                type="password"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder={
                  iyzico?.secretKeySet
                    ? "Değiştirmek için yeni değer girin"
                    : "IyziCo Secret Key"
                }
                autoComplete="off"
                className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              {iyzico?.secretKeySet && (
                <p className="mt-1 text-xs text-neutral-500">
                  Mevcut secret key kayıtlı. Değiştirmek için yeni değer girebilirsiniz.
                </p>
              )}
            </div>
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={isSandbox}
                onChange={(e) => setIsSandbox(e.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-amber-600 focus:ring-amber-500"
              />
              <span className="text-sm font-medium text-neutral-700">Test modu (sandbox)</span>
            </label>
            <p className="text-xs text-neutral-500">
              Test modu açıkken IyziCo sandbox ortamı kullanılır.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-60"
          >
            {isPending ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </form>
    </div>
  );
}
