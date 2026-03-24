"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { toggleTableActive } from "@/app/actions/toggle-table-active";
import { ArrowRightLeft, CreditCard, GitMerge, ListChecks, UtensilsCrossed } from "lucide-react";
import { formatTryCurrency } from "@/lib/currency";

type TableRow = {
  id: number;
  tableNo: number;
  isActive: boolean;
  hasActiveOrders: boolean;
  lastOrder?: {
    status: string;
    createdAt: Date;
    totalPrice: string;
    id: number;
  };
};

type TableSummary = {
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
  tables: TableRow[];
  tableSummaries: TableSummary[];
  onPaymentClick: (tableId: number) => void;
  onOrderClick: (tableId: number) => void;
  onTransferFull?: (tableId: number) => void;
  onTransferMerge?: (tableId: number) => void;
  onTransferPartial?: (tableId: number) => void;
};

export default function WaiterTableCards({
  tables,
  tableSummaries,
  onPaymentClick,
  onOrderClick,
  onTransferFull,
  onTransferMerge,
  onTransferPartial,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const summaryByTableId = new Map(tableSummaries.map((s) => [s.tableId, s]));

  const handleToggle = (tableId: number, isActive: boolean, hasActiveOrders: boolean) => {
    if (!isActive && hasActiveOrders) {
      toast.error("Bu masadaki aktif siparişleri iptal etmeden masa kapatilamaz.");
      return;
    }
    startTransition(async () => {
      const result = await toggleTableActive(tableId, !isActive);
      if (result.success) {
        toast.success(isActive ? "Masa kapatildi." : "Masa acildi.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Islem basarisiz.");
      }
    });
  };

  return (
    <section className="waiter-section rounded-2xl p-4">
      <h2 className="waiter-section-title mb-3 text-base font-semibold">Masa Yönetimi</h2>
      <div className="grid gap-3 md:grid-cols-3">
        {tables.map((table) => {
          const summary = summaryByTableId.get(table.id);
          return (
            <div
              key={table.id}
              className={`waiter-card flex flex-col rounded-2xl px-3 py-3 text-sm ${
                table.isActive ? "waiter-card-active" : ""
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Masa</p>
                  <p className="text-lg font-bold text-neutral-900">{table.tableNo}</p>
                </div>
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleToggle(table.id, table.isActive, table.hasActiveOrders)}
                  className="rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs font-medium hover:bg-neutral-100 disabled:opacity-60"
                >
                  {table.isActive ? "Kapat" : "Aç"}
                </button>
              </div>
              <div className="mb-2 flex flex-wrap gap-1.5">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    table.isActive ? "waiter-status-chip-success" : "waiter-status-chip-warning"
                  }`}
                >
                  {table.isActive ? "Masa açık" : "Masa kapalı"}
                </span>
                {table.hasActiveOrders ? (
                  <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold waiter-status-chip-info">
                    Aktif sipariş var
                  </span>
                ) : null}
              </div>

              {table.isActive && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => onPaymentClick(table.id)}
                    className="inline-flex items-center gap-1 rounded-lg bg-[color:var(--ui-primary)] px-2 py-1 text-xs font-medium text-white hover:bg-[color:var(--ui-primary-hover)]"
                  >
                    <CreditCard className="h-3.5 w-3.5" />
                    Ödeme Al
                  </button>
                  <button
                    type="button"
                    onClick={() => onOrderClick(table.id)}
                    className="inline-flex items-center gap-1 rounded-lg border border-neutral-300 bg-white px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
                  >
                    <UtensilsCrossed className="h-3.5 w-3.5" />
                    Sipariş
                  </button>
                  {onTransferFull ? (
                    <button
                      type="button"
                      onClick={() => onTransferFull(table.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5" />
                      Hesabi Tasima
                    </button>
                  ) : null}
                  {onTransferMerge ? (
                    <button
                      type="button"
                      onClick={() => onTransferMerge(table.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-900 hover:bg-sky-100"
                    >
                      <GitMerge className="h-3.5 w-3.5" />
                      Masa Birlestir
                    </button>
                  ) : null}
                  {onTransferPartial ? (
                    <button
                      type="button"
                      onClick={() => onTransferPartial(table.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-medium text-violet-900 hover:bg-violet-100"
                    >
                      <ListChecks className="h-3.5 w-3.5" />
                      Kalem Tasima
                    </button>
                  ) : null}
                </div>
              )}

              <div className="mt-auto space-y-1 text-xs text-neutral-600">
                {summary && summary.remainingAmount > 0 && (
                  <p className="font-medium text-amber-700">Ödenmemiş: {formatTryCurrency(summary.remainingAmount)}</p>
                )}
                {summary && summary.overpaidAmount > 0 && (
                  <p className="font-medium text-emerald-700">Fazla Ödeme: {formatTryCurrency(summary.overpaidAmount)}</p>
                )}
                {table.lastOrder ? (
                  <>
                    <p>
                      Son Sipariş:{" "}
                      <span className="font-semibold">#{table.lastOrder.id} • {formatTryCurrency(table.lastOrder.totalPrice)}</span>
                    </p>
                    <p>
                      Durum:{" "}
                      <span className="font-semibold">
                        {table.lastOrder.status === "PENDING_WAITER_APPROVAL" && "Garson Onayı Bekliyor"}
                        {table.lastOrder.status === "PENDING" && "Bekliyor"}
                        {table.lastOrder.status === "PREPARING" && "Hazırlanıyor"}
                        {table.lastOrder.status === "COMPLETED" && "Tamamlandı"}
                        {table.lastOrder.status === "REJECTED" && "Reddedildi"}
                      </span>
                    </p>
                  </>
                ) : (
                  <p className="text-neutral-500">Bu masadan henüz sipariş yok.</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}


