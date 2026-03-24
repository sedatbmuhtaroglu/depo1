"use client";

import React, { useState, useTransition } from "react";
import { Clock, Check } from "lucide-react";
import toast from "react-hot-toast";
import { updateBillRequestStatus } from "@/app/actions/update-bill-request-status";
import { settleBillWithPayment } from "@/app/actions/settle-bill-with-payment";
import { createIyzicoCheckout } from "@/app/actions/create-iyzico-checkout";
import { getBillRequestPaymentSummary } from "@/app/actions/get-bill-request-payment-summary";
import { formatTryCurrency } from "@/lib/currency";

type BillRequest = {
  id: number;
  table: { tableNo: number };
  status: "PENDING" | "ACKNOWLEDGED" | "SETTLED" | "CANCELED";
  createdAt: Date;
};

type LivePaymentSummary = {
  tableId: number;
  tableNo: number;
  totalAmount: number;
  totalCompletedAmount: number;
  billableTotal: number;
  onlinePaidTotal: number;
  grossPaidAmount: number;
  refundedAmount: number;
  netPaidAmount: number;
  remainingAmount: number;
  overpaidAmount: number;
  collectedAtTableTotal: number;
  collectibleTotal: number;
  completedCycleLines: Array<{
    productName: string;
    quantity: number;
    lineTotal: number;
  }>;
  activeOrderLines: Array<{
    productName: string;
    quantity: number;
    lineTotal: number;
    statusLabel: string;
  }>;
};

type Props = {
  requests: BillRequest[];
  iyzicoEnabled?: boolean;
};

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BillRequestsSection({
  requests,
  iyzicoEnabled = false,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [liveSummary, setLiveSummary] = useState<LivePaymentSummary | null>(null);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<
    "CASH" | "CREDIT_CARD" | "SODEXO" | "MULTINET" | "TICKET" | "METROPOL"
  >("CASH");
  const [paymentNote, setPaymentNote] = useState("");

  const openRequests = requests.filter(
    (request) => request.status === "PENDING" || request.status === "ACKNOWLEDGED",
  );
  const settledRequests = requests.filter((request) => request.status === "SETTLED");

  const handleAcknowledgeRequest = (requestId: number) => {
    if (isPending) return;
    startTransition(async () => {
      const result = await updateBillRequestStatus(requestId, "ACKNOWLEDGED");
      if (result.success) {
        toast.success(result.message || "Hesap isteği alındı olarak işaretlendi.");
      } else {
        toast.error(result.message || "Hesap isteği güncellenemedi.");
      }
    });
  };

  const handleCancelRequest = (requestId: number) => {
    if (isPending) return;
    startTransition(async () => {
      const result = await updateBillRequestStatus(requestId, "CANCELED");
      if (result.success) {
        toast.success(result.message || "Hesap isteği vazgeçildi olarak kapatıldı.");
      } else {
        toast.error(result.message || "Hesap isteği kapatılamadı.");
      }
    });
  };

  const openPaymentModal = async (requestId: number) => {
    setSelectedRequestId(requestId);
    setPaymentAmount("");
    setPaymentMethod("CASH");
    setPaymentNote("");
    setLiveSummary(null);
    setIsPaymentModalOpen(true);
    setIsSummaryLoading(true);

    const result = await getBillRequestPaymentSummary(requestId);
    if (!result.success || !("summary" in result)) {
      toast.error(result.message ?? "Anlık hesap özeti alınamadı.");
      setIsPaymentModalOpen(false);
      setSelectedRequestId(null);
      setIsSummaryLoading(false);
      return;
    }

    const summary = result.summary as LivePaymentSummary;
    setLiveSummary(summary);
    if (summary.collectibleTotal > 0) {
      setPaymentAmount(summary.collectibleTotal.toFixed(2));
    }
    setIsSummaryLoading(false);
  };

  const selectedRequest = openRequests.find((request) => request.id === selectedRequestId);
  const tableNo = liveSummary?.tableNo ?? selectedRequest?.table.tableNo ?? 0;

  const parsePaymentAmount = () => {
    const source =
      paymentAmount.trim() !== ""
        ? paymentAmount
        : liveSummary != null
          ? String(liveSummary.collectibleTotal)
          : paymentAmount;
    return Number(source.replace(",", "."));
  };

  const handlePayWithCard = () => {
    if (!selectedRequestId || !tableNo) return;
    const parsedAmount = parsePaymentAmount();
    if (!parsedAmount || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Geçerli bir tutar giriniz.");
      return;
    }

    startTransition(async () => {
      const result = await createIyzicoCheckout({
        billRequestId: selectedRequestId,
        amount: parsedAmount,
        tableNo,
      });
      if (result.success && result.paymentPageUrl) {
        window.location.href = result.paymentPageUrl;
        return;
      }
      toast.error(result.message ?? "Kart ödemesi başlatılamadı.");
    });
  };

  const handleSubmitPayment = () => {
    if (!selectedRequestId) return;
    const parsedAmount = parsePaymentAmount();
    if (!parsedAmount || !Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error("Geçerli bir tutar giriniz.");
      return;
    }

    startTransition(async () => {
      const result = await settleBillWithPayment({
        billRequestId: selectedRequestId,
        amount: parsedAmount,
        method: paymentMethod,
        note: paymentNote || undefined,
      });

      if (result.success) {
        toast.success(result.message || "Hesap kapatıldı.");
        setIsPaymentModalOpen(false);
        setSelectedRequestId(null);
      } else {
        toast.error(result.message || "Hesap kapatılamadı.");
      }
    });
  };

  if (!requests.length) return null;

  return (
    <section className="waiter-section space-y-4 rounded-2xl p-4">
      {openRequests.length > 0 && (
        <div>
          <h2 className="waiter-section-title mb-3 text-lg font-semibold">Hesap İstekleri</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {openRequests.map((request) => (
              <div
                key={request.id}
                className="waiter-card waiter-card-muted flex flex-col rounded-2xl border-amber-300 px-3 py-3 text-sm"
              >
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                      Masa
                    </p>
                    <p className="text-lg font-bold text-neutral-900">{request.table.tableNo}</p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                      request.status === "PENDING"
                        ? "waiter-status-chip-warning"
                        : "waiter-status-chip-info"
                    }`}
                  >
                    <Clock className="mr-1 h-3.5 w-3.5" />
                    {request.status === "PENDING" ? "Yeni hesap isteği" : "Hesap hazırlanıyor"}
                  </span>
                </div>

                <p className="mb-3 text-xs text-neutral-500">{formatTime(request.createdAt)}</p>

                <div className="mt-auto flex flex-wrap justify-end gap-2">
                  {request.status === "PENDING" && (
                    <button
                      disabled={isPending}
                      onClick={() => handleAcknowledgeRequest(request.id)}
                      className="rounded-xl border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50 disabled:opacity-60"
                    >
                      Hesap alındı
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleCancelRequest(request.id)}
                    className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 disabled:opacity-60"
                  >
                    Vazgeçildi
                  </button>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      void openPaymentModal(request.id);
                    }}
                    className="rounded-xl bg-[color:var(--ui-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[color:var(--ui-primary-hover)] disabled:opacity-60"
                  >
                    Ödeme Al / Kapat
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {settledRequests.length > 0 && (
        <div>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Son Kapatılan Hesaplar
          </h3>
          <div className="grid gap-2 md:grid-cols-3 lg:grid-cols-4">
            {settledRequests.slice(0, 8).map((request) => (
              <div
                key={request.id}
                className="waiter-card waiter-card-muted flex flex-col rounded-2xl px-3 py-2 text-xs"
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold">Masa {request.table.tableNo}</span>
                  <span className="text-neutral-500">{formatTime(request.createdAt)}</span>
                </div>
                <span className="waiter-status-chip-success mt-auto inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold">
                  <Check className="mr-1 h-3 w-3" />
                  Kapatıldı
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-elevated)] p-4 shadow-xl">
            <h3 className="mb-3 text-base font-semibold text-neutral-900">Ödeme Al ve Hesabı Kapat</h3>
            {isSummaryLoading ? (
              <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-600">
                Güncel hesap bilgisi alınıyor...
              </div>
            ) : liveSummary ? (
              <div className="mb-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3 text-xs text-neutral-700">
                <p className="flex items-center justify-between">
                  <span>Toplam</span>
                  <span className="font-semibold">{formatTryCurrency(liveSummary.totalAmount, { debug: true })}</span>
                </p>
                <p className="mt-1 flex items-center justify-between">
                  <span>Brüt Ödenen</span>
                  <span className="font-semibold text-sky-700">{formatTryCurrency(liveSummary.grossPaidAmount)}</span>
                </p>
                <p className="mt-1 flex items-center justify-between">
                  <span>İade</span>
                  <span className="font-semibold text-red-700">{formatTryCurrency(liveSummary.refundedAmount)}</span>
                </p>
                <p className="mt-1 flex items-center justify-between">
                  <span>Net Ödenen</span>
                  <span className="font-semibold text-emerald-700">{formatTryCurrency(liveSummary.netPaidAmount)}</span>
                </p>
                <p className="mt-2 flex items-center justify-between border-t border-neutral-200 pt-2 text-sm">
                  <span className="font-semibold">Kalan</span>
                  <span className="font-bold text-amber-700">
                    {formatTryCurrency(liveSummary.remainingAmount)}
                  </span>
                </p>
                {liveSummary.overpaidAmount > 0 && (
                  <p className="mt-1 flex items-center justify-between font-semibold text-emerald-700">
                    <span>Fazla Ödeme</span>
                    <span>{formatTryCurrency(liveSummary.overpaidAmount)}</span>
                  </p>
                )}

                {liveSummary.completedCycleLines.length > 0 && (
                  <div className="mt-3 border-t border-neutral-200 pt-2">
                    <p className="text-[11px] font-semibold text-neutral-600">
                      Tahsilat hesabı ürün dökümü
                    </p>
                    <ul className="mt-1 space-y-1">
                      {liveSummary.completedCycleLines.map((line, index) => (
                        <li key={`${line.productName}-${index}`} className="flex items-center justify-between">
                          <span>
                            {line.quantity}x {line.productName}
                          </span>
                          <span className="font-semibold">{formatTryCurrency(line.lineTotal)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {liveSummary.activeOrderLines.length > 0 && (
                  <div className="mt-3 border-t border-neutral-200 pt-2">
                    <p className="text-[11px] font-semibold text-neutral-600">
                      Mevcut masa sipariş durumu
                    </p>
                    <ul className="mt-1 max-h-36 space-y-1 overflow-y-auto pr-1">
                      {liveSummary.activeOrderLines.map((line, index) => (
                        <li
                          key={`${line.productName}-${line.statusLabel}-${index}`}
                          className="rounded border border-neutral-200 bg-white px-2 py-1"
                        >
                          <div className="flex items-center justify-between">
                            <span>
                              {line.quantity}x {line.productName}
                            </span>
                            <span className="font-semibold">{formatTryCurrency(line.lineTotal)}</span>
                          </div>
                          <p className="text-[10px] text-neutral-500">{line.statusLabel}</p>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-600">Tutar (TL)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={paymentAmount}
                  onChange={(event) => setPaymentAmount(event.target.value)}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="Örn. 350,00"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-600">Ödeme Yöntemi</label>
                <select
                  value={paymentMethod}
                  onChange={(event) =>
                    setPaymentMethod(
                      event.target.value as
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
                  <option value="CASH">Nakit</option>
                  <option value="CREDIT_CARD">Kredi Kartı</option>
                  <option value="SODEXO">Sodexo</option>
                  <option value="MULTINET">Multinet</option>
                  <option value="TICKET">Ticket</option>
                  <option value="METROPOL">Metropol</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-600">Not (opsiyonel)</label>
                <textarea
                  value={paymentNote}
                  onChange={(event) => setPaymentNote(event.target.value)}
                  rows={2}
                  className="w-full resize-none rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  placeholder="İsteğe bağlı açıklama"
                />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={isPending || isSummaryLoading}
                onClick={() => setIsPaymentModalOpen(false)}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 disabled:opacity-60"
              >
                İptal
              </button>
              {iyzicoEnabled && paymentMethod === "CREDIT_CARD" && (
                <button
                  type="button"
                  disabled={isPending || isSummaryLoading}
                  onClick={handlePayWithCard}
                  className="rounded-xl bg-[color:var(--ui-warning)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:brightness-[0.96] disabled:opacity-60"
                >
                  Kart ile öde (Iyzico)
                </button>
              )}
              <button
                type="button"
                disabled={isPending || isSummaryLoading}
                onClick={handleSubmitPayment}
                className="rounded-xl bg-[color:var(--ui-primary)] px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[color:var(--ui-primary-hover)] disabled:opacity-60"
              >
                Ödemeyi Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}


