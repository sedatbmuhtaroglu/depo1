"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import toast from "react-hot-toast";
import { ArrowRightLeft, GitMerge, ListChecks } from "lucide-react";
import { formatTryCurrency } from "@/lib/currency";
import {
  getTableTransferContext,
  mergeTableAccounts,
  transferOrderLinesPartial,
  transferTableAccountFull,
} from "@/app/actions/table-account-transfer";

type TableLite = { id: number; tableNo: number; isActive: boolean };

export type TransferModalMode = "full" | "merge" | "partial";

type ContextOrder = {
  id: number;
  status: string;
  note: string | null;
  totalPrice: number;
  partialAllowed: boolean;
  partialBlockReason: string | null;
  lineRows: Array<{
    lineIndex: number;
    productId: number;
    productName: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
};

type Props = {
  mode: TransferModalMode | null;
  sourceTableId: number | null;
  tables: TableLite[];
  onClose: () => void;
  onSuccess: () => void;
};

export default function TableAccountTransferModal({ mode, sourceTableId, tables, onClose, onSuccess }: Props) {
  const [isPending, startTransition] = useTransition();
  const [targetId, setTargetId] = useState<number | "">("");
  const [mergeSources, setMergeSources] = useState<Set<number>>(() => {
    if (mode === "merge" && typeof sourceTableId === "number") {
      return new Set([sourceTableId]);
    }
    return new Set();
  });
  const [ctxLoading, setCtxLoading] = useState(true);
  const [ctxError, setCtxError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ tableNo: number; billSnippet: string; remainingAmount: number } | null>(
    null,
  );
  const [orders, setOrders] = useState<ContextOrder[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<number | "">("");
  const [linePick, setLinePick] = useState<Set<number>>(new Set());

  const open = mode != null && sourceTableId != null;
  const sourceTable = tables.find((t) => t.id === sourceTableId);
  const sourceNo = sourceTable?.tableNo ?? sourceTableId ?? "";

  const targetOptions = useMemo(() => {
    return tables.filter((t) => t.id !== sourceTableId).sort((a, b) => a.tableNo - b.tableNo);
  }, [tables, sourceTableId]);

  useEffect(() => {
    if (!open || !sourceTableId || !mode) return;
    let cancelled = false;
    void getTableTransferContext(sourceTableId).then((res) => {
      if (cancelled) return;
      setCtxLoading(false);
      if (!res.success) {
        setCtxError(res.message ?? "Yuklenemedi.");
        setPreview(null);
        setOrders([]);
        return;
      }
      setCtxError(null);
      setPreview({
        tableNo: res.preview.tableNo,
        billSnippet: res.preview.billSnippet,
        remainingAmount: res.preview.remainingAmount,
      });
      if (mode === "partial") {
        setOrders(res.orders as ContextOrder[]);
      } else {
        setOrders([]);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, sourceTableId, mode]);

  const selectedOrder = orders.find((o) => o.id === selectedOrderId);

  const targetTable = typeof targetId === "number" ? tables.find((t) => t.id === targetId) : undefined;
  const targetNo = targetTable?.tableNo ?? targetId;

  const handleTargetChange = (value: string) => {
    const next = value ? Number(value) : "";
    setTargetId(next);
    if (typeof next === "number") {
      setMergeSources((prev) => {
        const n = new Set(prev);
        n.delete(next);
        return n;
      });
    }
  };

  const canSubmit =
    typeof targetId === "number" &&
    targetId > 0 &&
    targetId !== sourceTableId &&
    !isPending &&
    !ctxLoading &&
    !ctxError;

  const title =
    mode === "full"
      ? "Hesabi Tasima"
      : mode === "merge"
        ? "Masa Birlestir"
        : mode === "partial"
          ? "Kalem Tasima"
          : "";

  const handleMergeToggle = (id: number) => {
    setMergeSources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (id === sourceTableId) return next;
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const runFull = () => {
    if (!canSubmit || sourceTableId == null || typeof targetId !== "number") return;
    startTransition(async () => {
      const res = await transferTableAccountFull({
        sourceTableId,
        targetTableId: targetId,
      });
      if (res.success) {
        toast.success(res.message);
        onSuccess();
        onClose();
      } else {
        toast.error(res.message);
      }
    });
  };

  const runMerge = () => {
    if (!canSubmit || sourceTableId == null || typeof targetId !== "number") return;
    const sources = [...mergeSources].filter((id) => id !== targetId);
    if (sources.length === 0) {
      toast.error("En az bir kaynak masa secin.");
      return;
    }
    startTransition(async () => {
      const res = await mergeTableAccounts({
        sourceTableIds: sources,
        targetTableId: targetId,
      });
      if (res.success) {
        toast.success(res.message);
        onSuccess();
        onClose();
      } else {
        toast.error(res.message);
      }
    });
  };

  const runPartial = () => {
    if (!canSubmit || sourceTableId == null || typeof targetId !== "number") return;
    if (typeof selectedOrderId !== "number") {
      toast.error("Sipariş secin.");
      return;
    }
    const idx = [...linePick];
    if (idx.length === 0) {
      toast.error("En az bir satir secin.");
      return;
    }
    startTransition(async () => {
      const res = await transferOrderLinesPartial({
        sourceTableId,
        targetTableId: targetId,
        orderId: selectedOrderId,
        lineIndexes: idx,
      });
      if (res.success) {
        toast.success(res.message);
        onSuccess();
        onClose();
      } else {
        toast.error(res.message);
      }
    });
  };

  if (!open || !mode) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-3 py-6">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-elevated)] p-4 shadow-[0_14px_36px_rgba(15,23,42,0.22)]">
        <div className="mb-3 flex items-start gap-2">
          {mode === "full" ? (
            <ArrowRightLeft className="mt-0.5 h-5 w-5 text-emerald-600" />
          ) : mode === "merge" ? (
            <GitMerge className="mt-0.5 h-5 w-5 text-emerald-600" />
          ) : (
            <ListChecks className="mt-0.5 h-5 w-5 text-emerald-600" />
          )}
          <div>
            <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
            <p className="text-xs text-neutral-600">
              Kaynak: <span className="font-semibold">Masa {sourceNo}</span>
            </p>
          </div>
        </div>

        {ctxLoading && <p className="mb-3 text-sm text-neutral-600">Hesap bilgileri yukleniyor...</p>}
        {ctxError && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {ctxError}
          </div>
        )}

        {preview && !ctxError && mode !== "partial" && (
          <div className="mb-3 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
            <p className="font-medium">Hesap ozeti</p>
            <p>{preview.billSnippet}</p>
          </div>
        )}

        {mode === "merge" && (
          <div className="mb-3 space-y-2">
            <p className="text-xs font-semibold text-neutral-600">Birlestirilecek masalar</p>
            <div className="max-h-40 space-y-1.5 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2">
              {tables
                .filter((t) => t.id !== targetId)
                .map((t) => (
                  <label key={t.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={mergeSources.has(t.id)}
                      onChange={() => handleMergeToggle(t.id)}
                      className="rounded border-neutral-300"
                    />
                    <span>
                      Masa {t.tableNo}
                      {!t.isActive ? (
                        <span className="ml-1 text-[11px] font-medium text-amber-700">(kapali)</span>
                      ) : null}
                    </span>
                  </label>
                ))}
            </div>
            <p className="text-[11px] text-neutral-500">
              Hedef masa secildikten sonra, isaretli masalarin acik hesaplari hedefe tasinir. Kaynak QR oturumlari
              kapatilir.
            </p>
          </div>
        )}

        {mode === "partial" && preview && !ctxError && (
          <div className="mb-3 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
            <p className="font-medium">Hesap ozeti</p>
            <p>{preview.billSnippet}</p>
            <p className="mt-1 text-neutral-600">
              Kalem tasima sadece uygun siparişlerde (onayli / mutfakta) ve iptal kaydi olmayan satirlarda yapilir.
            </p>
          </div>
        )}

        {mode === "partial" && !ctxLoading && !ctxError && orders.length > 0 && (
          <div className="mb-3 space-y-2">
            <label className="block text-xs font-semibold text-neutral-600">Sipariş</label>
            <select
              value={selectedOrderId === "" ? "" : String(selectedOrderId)}
              onChange={(e) => {
                const v = e.target.value ? Number(e.target.value) : "";
                setSelectedOrderId(v);
                setLinePick(new Set());
              }}
              className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
            >
              <option value="">Sipariş secin</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  #{o.id} · {formatTryCurrency(o.totalPrice)} · {o.status}
                </option>
              ))}
            </select>

            {selectedOrder && (
              <div className="space-y-2">
                {!selectedOrder.partialAllowed && (
                  <p className="text-xs text-amber-800">{selectedOrder.partialBlockReason ?? "Bu siparişte kalem tasinamaz."}</p>
                )}
                {selectedOrder.partialAllowed && (
                  <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-neutral-200 bg-white p-2">
                    {selectedOrder.lineRows.map((row) => (
                      <label key={row.lineIndex} className="flex cursor-pointer items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={linePick.has(row.lineIndex)}
                          onChange={() => {
                            setLinePick((prev) => {
                              const n = new Set(prev);
                              if (n.has(row.lineIndex)) n.delete(row.lineIndex);
                              else n.add(row.lineIndex);
                              return n;
                            });
                          }}
                          className="mt-1 rounded border-neutral-300"
                        />
                        <span>
                          <span className="font-medium">{row.productName}</span>
                          <span className="text-neutral-600">
                            {" "}
                            x{row.quantity} · {formatTryCurrency(row.lineTotal)}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mb-3">
          <label className="mb-1 block text-xs font-semibold text-neutral-600">Hedef masa</label>
          <select
            value={targetId === "" ? "" : String(targetId)}
            onChange={(e) => handleTargetChange(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          >
            <option value="">Masa secin</option>
            {targetOptions.map((t) => (
              <option key={t.id} value={t.id}>
                Masa {t.tableNo}
                {!t.isActive ? " (kapali — islemde acilacak)" : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-neutral-500">
            Kaynak masayla ayni masa secilemez. Kapali hedef masa, islem onayinda otomatik acilir.
          </p>
        </div>

        {typeof targetId === "number" && targetId > 0 && (
          <div className="mb-4 rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs text-neutral-700">
            <p className="font-semibold text-neutral-900">Onay ozeti</p>
            <p>
              Kaynak: Masa {sourceNo} {preview ? `· ${preview.billSnippet}` : ""}
            </p>
            <p>
              Hedef: Masa {targetNo}
              {targetTable && !targetTable.isActive ? " (acilacak)" : ""}
            </p>
            {mode === "partial" && selectedOrder && (
              <p>
                Tasinacak satir: {linePick.size} · Tahmini tutar:{" "}
                {formatTryCurrency(
                  selectedOrder.lineRows.filter((r) => linePick.has(r.lineIndex)).reduce((s, r) => s + r.lineTotal, 0),
                )}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={onClose}
            className="rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50 disabled:opacity-60"
          >
            Vazgec
          </button>
          {mode === "full" && (
            <button
              type="button"
              disabled={!canSubmit}
              onClick={runFull}
              className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-60"
            >
              Tasima
            </button>
          )}
          {mode === "merge" && (
            <button
              type="button"
              disabled={!canSubmit}
              onClick={runMerge}
              className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-60"
            >
              Birlestir
            </button>
          )}
          {mode === "partial" && (
            <button
              type="button"
              disabled={
                !canSubmit ||
                typeof selectedOrderId !== "number" ||
                !selectedOrder?.partialAllowed ||
                linePick.size === 0
              }
              onClick={runPartial}
              className="rounded-xl bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-600 disabled:opacity-60"
            >
              Kalemleri Tasiy
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
