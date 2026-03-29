"use client";

import React, { useState, useTransition } from "react";
import toast from "react-hot-toast";
import { recordTablePayment } from "@/app/actions/record-table-payment";
import { createBillRequestForTable } from "@/app/actions/create-bill-request-for-table";
import { createIyzicoCheckout } from "@/app/actions/create-iyzico-checkout";
import { formatTryCurrency } from "@/lib/currency";

type Summary = {
  tableId: number;
  tableNo: number;
  totalAmount: number;
  totalFromOrders: number;
  grossPaidAmount: number;
  refundedAmount: number;
  netPaidAmount: number;
  remainingAmount: number;
  overpaidAmount: number;
  paid: number;
  unpaid: number;
};

type Props = {
  summary: Summary | null;
  iyzicoEnabled: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

const PAYMENT_METHODS = [
  { value: "CASH" as const, label: "Nakit" },
  { value: "CREDIT_CARD" as const, label: "Kredi Karti" },
  { value: "SODEXO" as const, label: "Sodexo" },
  { value: "MULTINET" as const, label: "Multinet" },
  { value: "TICKET" as const, label: "Ticket" },
  { value: "METROPOL" as const, label: "Metropol" },
];

export default function TablePaymentModal({
  summary,
  iyzicoEnabled,
  onClose,
  onSuccess,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<
    "CASH" | "CREDIT_CARD" | "SODEXO" | "MULTINET" | "TICKET" | "METROPOL"
  >("CASH");
  const [note, setNote] = useState("");

  const remainingAmount = summary?.remainingAmount ?? 0;
  const defaultAmount = remainingAmount > 0 ? String(remainingAmount.toFixed(2)) : "";

  const openModal = summary != null;

  const [amountSourceTableId, setAmountSourceTableId] = useState<number | null>(null);
  const effectiveAmount =
    amountSourceTableId === summary?.tableId || amount === "" ? amount || defaultAmount : defaultAmount;

  const parsedAmount = Number(effectiveAmount.replace(",", "."));
  const isValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;

  const handlePayWithCard = () => {
    if (!summary || !isValidAmount) {
      toast.error("Geçerli bir tutar giriniz.");
      return;
    }
    startTransition(async () => {
      const billRes = await createBillRequestForTable(summary.tableId);
      if (!billRes.success || !billRes.billRequestId) {
        toast.error(billRes.message ?? "Hesap isteği oluşturulamadı.");
        return;
      }
      const result = await createIyzicoCheckout({
        billRequestId: billRes.billRequestId,
        amount: parsedAmount,
        tableNo: summary.tableNo,
      });
      if (result.success && result.paymentPageUrl) {
        window.location.href = result.paymentPageUrl;
        return;
      }
      toast.error(result.message ?? "Kart ödemesi başlatılamadı.");
    });
  };

  const handleSubmit = () => {
    if (!summary || !isValidAmount) {
      toast.error("Geçerli bir tutar giriniz.");
      return;
    }
    startTransition(async () => {
      const result = await recordTablePayment({
        tableId: summary.tableId,
        amount: parsedAmount,
        method,
        note: note.trim() || undefined,
      });
      if (result.success) {
        toast.success(result.message ?? "Ödeme kaydedildi.");
        onSuccess();
        onClose();
      } else {
        toast.error(result.message ?? "Ödeme kaydedilemedi.");
      }
    });
  };

  if (!openModal) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-elevated)] p-4 shadow-[0_14px_36px_rgba(15,23,42,0.22)]">
        <h3 className="mb-3 text-base font-semibold text-neutral-900">Ödeme Al - Masa {summary.tableNo}</h3>

        <div className="mb-4 space-y-1 rounded-xl bg-neutral-50 p-3 text-sm">
          <p className="flex justify-between">
            <span className="text-neutral-600">Toplam</span>
            <span className="font-semibold">{formatTryCurrency(summary.totalAmount, { debug: true })}</span>
          </p>
          <p className="flex justify-between text-neutral-600">
            <span>Brüt Ödenen</span>
            <span>{formatTryCurrency(summary.grossPaidAmount)}</span>
          </p>
          <p className="flex justify-between text-neutral-600">
            <span>İade</span>
            <span>{formatTryCurrency(summary.refundedAmount)}</span>
          </p>
          <p className="flex justify-between text-neutral-600">
            <span>Net Ödenen</span>
            <span>{formatTryCurrency(summary.netPaidAmount)}</span>
          </p>
          <p className="flex justify-between border-t border-neutral-200 pt-2 font-medium">
            <span>Kalan</span>
            <span>{formatTryCurrency(summary.remainingAmount)}</span>
          </p>
          {summary.overpaidAmount > 0 && (
            <p className="flex justify-between font-medium text-emerald-700">
              <span>Fazla Ödeme</span>
              <span>{formatTryCurrency(summary.overpaidAmount)}</span>
            </p>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-600">Tutar (₺)</label>
            <input
              type="text"
              inputMode="decimal"
              value={effectiveAmount}
              onChange={(e) => {
                setAmount(e.target.value);
                setAmountSourceTableId(summary?.tableId ?? null);
              }}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder={defaultAmount || "0,00"}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-600">Ödeme yöntemi</label>
            <select
              value={method}
              onChange={(e) =>
                setMethod(
                  e.target.value as
                    | "CASH"
                    | "CREDIT_CARD"
                    | "SODEXO"
                    | "MULTINET"
                    | "TICKET"
                    | "METROPOL",
                )
              }
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-600">Not (opsiyonel)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              placeholder="İsteğe bağlı"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 disabled:opacity-60"
          >
            İptal
          </button>
          {iyzicoEnabled && method === "CREDIT_CARD" && (
            <button
              type="button"
              disabled={isPending || !isValidAmount}
              onClick={handlePayWithCard}
              className="rounded-xl bg-orange-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-orange-600 disabled:opacity-60"
            >
              Kart ile öde (Iyzico)
            </button>
          )}
          <button
            type="button"
            disabled={isPending || !isValidAmount}
            onClick={handleSubmit}
            className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-emerald-500/20 hover:bg-emerald-600 disabled:opacity-60"
          >
            Ödemeyi Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}


