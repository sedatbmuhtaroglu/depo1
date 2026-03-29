"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  processCashSplitPayment,
  type SplitPaymentLineInput,
  type SplitPaymentReceiptView,
} from "@/app/actions/process-cash-split-payment";
import { formatTryCurrency } from "@/lib/currency";
import { badgeClasses, buttonClasses, cardClasses, fieldClasses } from "@/lib/ui/button-variants";

type CashMethod = "CASH" | "CREDIT_CARD" | "SODEXO" | "MULTINET" | "TICKET" | "METROPOL";

const METHOD_OPTIONS: Array<{ value: CashMethod; label: string }> = [
  { value: "CASH", label: "Nakit" },
  { value: "CREDIT_CARD", label: "Kredi Karti" },
  { value: "SODEXO", label: "Sodexo" },
  { value: "MULTINET", label: "Multinet" },
  { value: "TICKET", label: "Ticket" },
  { value: "METROPOL", label: "Metropol" },
];

type PaymentDraftLine = {
  id: string;
  method: CashMethod;
  amountInput: string;
  note: string;
};

type CashTerminalItem = {
  key: string;
  productName: string;
  variantSummary: string | null;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  note: string | null;
};

type CashTerminalPayment = {
  id: number;
  createdAtIso: string;
  amount: number;
  method: string;
  note: string | null;
};

export type CashTerminalTable = {
  tableId: number;
  tableNo: number;
  lastActionAtIso: string | null;
  statusBadges: {
    hasActiveOrder: boolean;
    hasOpenBillRequest: boolean;
    hasPartialPayment: boolean;
    waitingClose: boolean;
  };
  finance: {
    subtotal: number;
    cancellationImpact: number;
    collectedAmount: number;
    remainingAmount: number;
    accountStatus: string;
    openBillRequestId: number | null;
    openBillRequestStatus: "PENDING" | "ACKNOWLEDGED" | null;
  };
  items: CashTerminalItem[];
  payments: CashTerminalPayment[];
};

type CashTerminalProps = {
  role: "MANAGER" | "CASHIER";
  tables: CashTerminalTable[];
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function buildPrintReceiptHtml(receipt: SplitPaymentReceiptView): string {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 2,
    }).format(value);
  const formatDate = new Date(receipt.issuedAtIso).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
  const methodLabel = (method: string) => {
    if (method === "CASH") return "Nakit";
    if (method === "CREDIT_CARD") return "Kredi Karti";
    if (method === "SODEXO") return "Sodexo";
    if (method === "MULTINET") return "Multinet";
    if (method === "TICKET") return "Ticket";
    if (method === "METROPOL") return "Metropol";
    return method;
  };

  const rows = receipt.lines
    .map((line) => {
      const noteHtml = line.note
        ? `<div class="note">Not: ${escapeHtml(line.note)}</div>`
        : "";
      return `<div class="line"><div class="row"><span>${escapeHtml(methodLabel(
        line.method,
      ))}</span><strong>${escapeHtml(formatCurrency(line.amount))}</strong></div>${noteHtml}</div>`;
    })
    .join("");

  return `<!doctype html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(receipt.title)}</title>
    <style>
      @page { margin: 8mm; }
      body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; color: #111827; margin: 0; }
      .wrap { width: 78mm; max-width: 100%; margin: 0 auto; }
      .title { text-align: center; font-size: 16px; font-weight: 700; margin: 0 0 4px; }
      .sub { text-align: center; color: #4b5563; font-size: 12px; margin: 0 0 10px; }
      .meta .row, .sum .row { display: flex; justify-content: space-between; gap: 10px; margin: 3px 0; font-size: 12px; }
      .meta .k, .sum .k { color: #6b7280; }
      .divider { border-top: 1px dashed #9ca3af; margin: 8px 0; }
      .section { font-size: 11px; letter-spacing: .04em; text-transform: uppercase; color: #6b7280; margin-bottom: 6px; }
      .line { margin-bottom: 5px; font-size: 12px; }
      .line .row { display: flex; justify-content: space-between; gap: 10px; }
      .note { color: #6b7280; font-size: 11px; margin-top: 2px; }
      .state { margin-top: 6px; padding: 5px 6px; background: #f3f4f6; border-radius: 6px; font-size: 11px; font-weight: 600; }
      .foot { margin-top: 10px; padding-top: 8px; border-top: 1px solid #d1d5db; color: #6b7280; font-size: 11px; line-height: 1.35; }
    </style>
  </head>
  <body>
    <div class="wrap">
      <h1 class="title">${escapeHtml(receipt.title)}</h1>
      <p class="sub">${escapeHtml(receipt.restaurantName)}</p>
      <div class="meta">
        <div class="row"><span class="k">Masa</span><span>Masa ${receipt.tableNo}</span></div>
        <div class="row"><span class="k">Tarih</span><span>${escapeHtml(formatDate)}</span></div>
        <div class="row"><span class="k">Referans</span><span>${escapeHtml(receipt.reference)}</span></div>
        <div class="row"><span class="k">Kasiyer</span><span>${escapeHtml(receipt.cashierName)}</span></div>
      </div>
      <div class="divider"></div>
      <div class="section">Odeme Yontemleri</div>
      ${rows}
      <div class="divider"></div>
      <div class="sum">
        <div class="row"><span class="k">Bu Islemde Tahsil Edilen</span><strong>${escapeHtml(
          formatCurrency(receipt.transactionTotal),
        )}</strong></div>
        <div class="row"><span class="k">Islem Oncesi Kalan</span><span>${escapeHtml(
          formatCurrency(receipt.remainingBefore),
        )}</span></div>
        <div class="row"><span class="k">Islem Sonrasi Kalan</span><strong>${escapeHtml(
          formatCurrency(receipt.remainingAfter),
        )}</strong></div>
      </div>
      <div class="state">Hesap kapatildi. Kalan: ${escapeHtml(formatCurrency(0))}</div>
      <p class="foot">${escapeHtml(receipt.disclaimer)}</p>
    </div>
  </body>
</html>`;
}

function printReceiptInHiddenFrame(receipt: SplitPaymentReceiptView): void {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.setAttribute("aria-hidden", "true");
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(buildPrintReceiptHtml(receipt));
  doc.close();
  iframe.contentWindow?.focus();
  iframe.contentWindow?.print();
  window.setTimeout(() => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }, 1200);
}

function sortByPriority(rows: CashTerminalTable[]): CashTerminalTable[] {
  return [...rows].sort((a, b) => {
    const aScore =
      (a.finance.remainingAmount > 0 ? 10 : 0) +
      (a.statusBadges.hasOpenBillRequest ? 5 : 0) +
      (a.statusBadges.hasPartialPayment ? 3 : 0) +
      (a.statusBadges.hasActiveOrder ? 2 : 0);
    const bScore =
      (b.finance.remainingAmount > 0 ? 10 : 0) +
      (b.statusBadges.hasOpenBillRequest ? 5 : 0) +
      (b.statusBadges.hasPartialPayment ? 3 : 0) +
      (b.statusBadges.hasActiveOrder ? 2 : 0);
    if (aScore !== bScore) return bScore - aScore;
    const aTs = a.lastActionAtIso ? new Date(a.lastActionAtIso).getTime() : 0;
    const bTs = b.lastActionAtIso ? new Date(b.lastActionAtIso).getTime() : 0;
    return bTs - aTs;
  });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("tr-TR", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildLineId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function parseMoneyInput(value: string): number {
  const normalized = value.replace(",", ".").trim();
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
}

function createDraftLine(defaultAmount?: number): PaymentDraftLine {
  return {
    id: buildLineId(),
    method: "CASH",
    amountInput: defaultAmount && defaultAmount > 0 ? defaultAmount.toFixed(2) : "",
    note: "",
  };
}

function buildMutationId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

export default function CashTerminal({ role, tables }: CashTerminalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");
  const [selectedTableId, setSelectedTableId] = useState<number | null>(tables[0]?.tableId ?? null);
  const [draftLines, setDraftLines] = useState<PaymentDraftLine[]>([createDraftLine()]);
  const [lastFullReceipt, setLastFullReceipt] = useState<SplitPaymentReceiptView | null>(null);
  const autoPrintedReceiptsRef = useRef<Set<string>>(new Set());

  const filteredTables = useMemo(() => {
    const q = query.trim();
    const rows = sortByPriority(tables);
    if (!q) return rows;
    return rows.filter((row) => String(row.tableNo).includes(q));
  }, [query, tables]);

  const selected = useMemo(
    () => filteredTables.find((row) => row.tableId === selectedTableId) ?? filteredTables[0] ?? null,
    [filteredTables, selectedTableId],
  );

  const parsedLines = useMemo(
    () =>
      draftLines.map((line) => ({
        ...line,
        parsedAmount: parseMoneyInput(line.amountInput),
      })),
    [draftLines],
  );

  const enteredTotal = useMemo(
    () => parsedLines.reduce((sum, line) => sum + line.parsedAmount, 0),
    [parsedLines],
  );

  const previousCollected = selected?.finance.collectedAmount ?? 0;
  const remainingBefore = selected?.finance.remainingAmount ?? 0;
  const remainingAfter = Math.round((remainingBefore - enteredTotal) * 100) / 100;
  const overpayment = Math.max(0, -remainingAfter);
  const validLineCount = parsedLines.filter((line) => line.parsedAmount > 0).length;
  const hasInvalidLine = parsedLines.some((line) => line.amountInput.trim().length > 0 && line.parsedAmount <= 0);

  const canSubmitPartial =
    selected != null &&
    validLineCount > 0 &&
    !hasInvalidLine &&
    enteredTotal > 0 &&
    remainingAfter > 0;
  const canSubmitFull =
    selected != null &&
    validLineCount > 0 &&
    !hasInvalidLine &&
    Math.abs(remainingAfter) <= 0.009;

  const resetDraftLines = (remaining: number) => {
    setDraftLines([createDraftLine(remaining > 0 ? remaining : undefined)]);
  };

  const ensureLineExists = () => {
    if (draftLines.length === 0) {
      resetDraftLines(selected?.finance.remainingAmount ?? 0);
    }
  };

  const onSelectTable = (tableId: number) => {
    setSelectedTableId(tableId);
    const next = filteredTables.find((row) => row.tableId === tableId);
    resetDraftLines(next?.finance.remainingAmount ?? 0);
  };

  useEffect(() => {
    if (selected && draftLines.length === 0) {
      resetDraftLines(selected.finance.remainingAmount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.tableId]);

  const addPaymentLine = () => {
    setDraftLines((prev) => [...prev, createDraftLine()]);
  };

  const removePaymentLine = (id: string) => {
    setDraftLines((prev) => {
      const next = prev.filter((line) => line.id !== id);
      return next.length === 0 ? [createDraftLine()] : next;
    });
  };

  const updateLine = (id: string, patch: Partial<PaymentDraftLine>) => {
    setDraftLines((prev) => prev.map((line) => (line.id === id ? { ...line, ...patch } : line)));
  };

  const submitSplitPayment = (mode: "PARTIAL" | "FULL") => {
    if (!selected) {
      toast.error("Masa secimi gerekli.");
      return;
    }
    ensureLineExists();

    const lines: SplitPaymentLineInput[] = parsedLines
      .filter((line) => line.parsedAmount > 0)
      .map((line) => ({
        method: line.method,
        amount: line.parsedAmount,
        note: line.note.trim() || undefined,
      }));

    if (lines.length === 0) {
      toast.error("En az bir odeme satiri girin.");
      return;
    }
    if (overpayment > 0) {
      toast.error("Fazla odeme var. Tutarlari duzeltmeden islem yapilamaz.");
      return;
    }

    startTransition(async () => {
      const mutationId = buildMutationId();
      const result = await processCashSplitPayment({
        tableId: selected.tableId,
        mode,
        lines,
        clientMutationId: mutationId,
      });

      if (!result.success) {
        toast.error(result.message ?? "Tahsilat kaydedilemedi.");
        return;
      }

      toast.success(result.message ?? "Tahsilat kaydedildi.");
      router.refresh();
      setDraftLines([createDraftLine()]);
      if (result.settled && result.receipt) {
        setLastFullReceipt(result.receipt);
        if (!autoPrintedReceiptsRef.current.has(result.receipt.receiptId)) {
          autoPrintedReceiptsRef.current.add(result.receipt.receiptId);
          printReceiptInHiddenFrame(result.receipt);
        }
      }
    });
  };

  return (
    <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
      <article className={cardClasses({ className: "p-4 sm:p-5" })}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
              Masa Operasyonu
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[color:var(--ui-text-primary)]">Kasa Terminali</h2>
            <p className="mt-1 text-sm text-[color:var(--ui-text-secondary)]">
              Masa secin, hesap detayini acin ve parcali/tam tahsilati tamamlayin.
            </p>
          </div>
          <span className={badgeClasses(role === "CASHIER" ? "success" : "neutral")}>
            {role === "CASHIER" ? "Kasiyer modu" : "Mudur gorunumu"}
          </span>
        </div>

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">Masa no ile ara</label>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            inputMode="numeric"
            placeholder="Orn: 12"
            className={fieldClasses({ size: "md" })}
          />
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTables.length === 0 ? (
            <div
              className={cardClasses({
                tone: "subtle",
                className: "sm:col-span-2 lg:col-span-3 p-3 text-sm text-[color:var(--ui-text-secondary)] shadow-none",
              })}
            >
              Odeme alinabilir aktif masa bulunamadi.
            </div>
          ) : (
            filteredTables.map((table) => {
              const active = selected?.tableId === table.tableId;
              return (
                <button
                  key={table.tableId}
                  type="button"
                  onClick={() => onSelectTable(table.tableId)}
                  className={[
                    "rounded-xl border p-3 text-left transition",
                    active
                      ? "border-[color:var(--ui-primary)] bg-[color:var(--ui-surface-subtle)]"
                      : "border-[color:var(--ui-border)] bg-[color:var(--ui-surface-bg)] hover:bg-[color:var(--ui-surface-subtle)]",
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-semibold text-[color:var(--ui-text-primary)]">Masa {table.tableNo}</p>
                    <span className={badgeClasses(table.finance.remainingAmount > 0 ? "warning" : "success")}>
                      {formatTryCurrency(Math.max(0, table.finance.remainingAmount))}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {table.statusBadges.hasActiveOrder && <span className={badgeClasses("info")}>Aktif siparis</span>}
                    {table.statusBadges.hasOpenBillRequest && <span className={badgeClasses("warning")}>Hesap istendi</span>}
                    {table.statusBadges.hasPartialPayment && <span className={badgeClasses("neutral")}>Kismi odeme</span>}
                    {table.statusBadges.waitingClose && <span className={badgeClasses("danger")}>Kapatilmayi bekliyor</span>}
                  </div>
                  <p className="mt-2 text-xs text-[color:var(--ui-text-secondary)]">Son islem: {formatDateTime(table.lastActionAtIso)}</p>
                </button>
              );
            })
          )}
        </div>
      </article>

      <article className={cardClasses({ className: "p-4 sm:p-5" })}>
        {selected == null ? (
          <p className="text-sm text-[color:var(--ui-text-secondary)]">Masa secimi bekleniyor.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Masa Detayi</p>
              <h3 className="mt-1 text-lg font-semibold text-[color:var(--ui-text-primary)]">Masa {selected.tableNo}</h3>
              <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">Son islem: {formatDateTime(selected.lastActionAtIso)}</p>
            </div>

            <div className="max-h-[240px] overflow-auto rounded-xl border border-[color:var(--ui-border)]">
              <table className="min-w-full text-sm">
                <thead className="bg-[color:var(--ui-surface-subtle)]">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Urun</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Adet</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Birim</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Toplam</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--ui-border)]">
                  {selected.items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-sm text-[color:var(--ui-text-secondary)]">Aktif siparis kalemi yok.</td>
                    </tr>
                  ) : (
                    selected.items.map((item) => (
                      <tr key={item.key}>
                        <td className="px-3 py-2.5">
                          <p className="font-medium text-[color:var(--ui-text-primary)]">{item.productName}</p>
                          {item.variantSummary && <p className="text-xs text-[color:var(--ui-text-secondary)]">{item.variantSummary}</p>}
                          {item.note && <p className="text-xs text-[color:var(--ui-text-secondary)]">Not: {item.note}</p>}
                        </td>
                        <td className="px-3 py-2.5 text-right text-[color:var(--ui-text-primary)]">{item.quantity}</td>
                        <td className="px-3 py-2.5 text-right text-[color:var(--ui-text-primary)]">{formatTryCurrency(item.unitPrice)}</td>
                        <td className="px-3 py-2.5 text-right font-semibold text-[color:var(--ui-text-primary)]">{formatTryCurrency(item.lineTotal)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="space-y-2">
              <div className={cardClasses({ tone: "subtle", className: "flex items-center justify-between px-3 py-2 shadow-none" })}>
                <span className="text-xs text-[color:var(--ui-text-secondary)]">Hesap toplami</span>
                <span className="text-sm font-semibold text-[color:var(--ui-text-primary)]">{formatTryCurrency(selected.finance.subtotal)}</span>
              </div>
              <div className={cardClasses({ tone: "subtle", className: "flex items-center justify-between px-3 py-2 shadow-none" })}>
                <span className="text-xs text-[color:var(--ui-text-secondary)]">Iptal/iade etkisi</span>
                <span className="text-sm font-semibold text-[color:var(--ui-text-primary)]">{formatTryCurrency(selected.finance.cancellationImpact)}</span>
              </div>
              <div className={cardClasses({ tone: "subtle", className: "flex items-center justify-between px-3 py-2 shadow-none" })}>
                <span className="text-xs text-[color:var(--ui-text-secondary)]">Daha once tahsil edilen</span>
                <span className="text-sm font-semibold text-[color:var(--ui-text-primary)]">{formatTryCurrency(previousCollected)}</span>
              </div>
              <div className={cardClasses({ tone: "warning", className: "flex items-center justify-between px-3 py-2 shadow-none" })}>
                <span className="text-xs text-[color:var(--ui-text-secondary)]">Islem oncesi kalan</span>
                <span className="text-sm font-semibold text-[color:var(--ui-text-primary)]">{formatTryCurrency(Math.max(0, remainingBefore))}</span>
              </div>
            </div>

            <div className="rounded-xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">Split Tahsilat</p>
                <button type="button" onClick={addPaymentLine} className={buttonClasses({ variant: "secondary", size: "xs", className: "h-8 px-2.5" })}>
                  Odeme ekle
                </button>
              </div>
              <div className="space-y-2">
                {draftLines.map((line, index) => (
                  <div key={line.id} className="grid gap-2 rounded-xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-bg)] p-2.5 sm:grid-cols-[1.1fr_1fr_1fr_auto]">
                    <select
                      value={line.method}
                      onChange={(event) => updateLine(line.id, { method: event.target.value as CashMethod })}
                      className={fieldClasses({ size: "sm" })}
                    >
                      {METHOD_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      value={line.amountInput}
                      onChange={(event) => updateLine(line.id, { amountInput: event.target.value })}
                      inputMode="decimal"
                      placeholder="Tutar"
                      className={fieldClasses({ size: "sm" })}
                    />
                    <input
                      value={line.note}
                      onChange={(event) => updateLine(line.id, { note: event.target.value })}
                      placeholder="Referans / not"
                      className={fieldClasses({ size: "sm" })}
                    />
                    <button type="button" onClick={() => removePaymentLine(line.id)} className={buttonClasses({ variant: "outline", size: "xs", className: "h-8 px-2" })}>
                      Sil
                    </button>
                    {parsedLines[index] && parsedLines[index]!.amountInput.trim().length > 0 && parsedLines[index]!.parsedAmount <= 0 && (
                      <p className="sm:col-span-4 text-xs text-[color:var(--ui-danger)]">Tutar sifirdan buyuk olmali.</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-3 space-y-1 text-xs">
                <p className="flex items-center justify-between text-[color:var(--ui-text-secondary)]">
                  <span>Bu islemde girilen toplam</span>
                  <span className="font-semibold text-[color:var(--ui-text-primary)]">{formatTryCurrency(enteredTotal)}</span>
                </p>
                <p className="flex items-center justify-between text-[color:var(--ui-text-secondary)]">
                  <span>Islem sonrasi kalan</span>
                  <span className="font-semibold text-[color:var(--ui-text-primary)]">{formatTryCurrency(Math.max(0, remainingAfter))}</span>
                </p>
                <p className="flex items-center justify-between text-[color:var(--ui-text-secondary)]">
                  <span>Fazla odeme / para ustu</span>
                  <span className={`font-semibold ${overpayment > 0 ? "text-[color:var(--ui-danger)]" : "text-[color:var(--ui-text-primary)]"}`}>
                    {formatTryCurrency(overpayment)}
                  </span>
                </p>
              </div>

              {overpayment > 0 && (
                <p className="mt-2 text-xs text-[color:var(--ui-danger)]">Girilen toplam kalan tutari asiyor. Islem kaydedilmez.</p>
              )}

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => submitSplitPayment("PARTIAL")}
                  disabled={isPending || !canSubmitPartial}
                  className={buttonClasses({ variant: "secondary", size: "md", className: "h-10 justify-center" })}
                >
                  Kismi odeme kaydet
                </button>
                <button
                  type="button"
                  onClick={() => submitSplitPayment("FULL")}
                  disabled={isPending || !canSubmitFull}
                  className={buttonClasses({ variant: "primary", size: "md", className: "h-10 justify-center" })}
                >
                  Tam tahsilat ve kapat
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] p-3">
              <p className="text-xs text-[color:var(--ui-text-secondary)]">
                Hesap durumu: <span className="font-semibold text-[color:var(--ui-text-primary)]">{selected.finance.accountStatus}</span>
              </p>
              <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
                Bill request:{" "}
                <span className="font-semibold text-[color:var(--ui-text-primary)]">
                  {selected.finance.openBillRequestId
                    ? `#${selected.finance.openBillRequestId} (${selected.finance.openBillRequestStatus})`
                    : "Yok"}
                </span>
              </p>
            </div>

            <div className="rounded-xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] p-3">
              <p className="text-xs font-medium text-[color:var(--ui-text-secondary)]">Iliskili odeme hareketleri</p>
              {selected.payments.length === 0 ? (
                <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">Kayit bulunmuyor.</p>
              ) : (
                <ul className="mt-2 space-y-1">
                  {selected.payments.map((payment) => (
                    <li key={payment.id} className="text-xs text-[color:var(--ui-text-primary)]">
                      {formatDateTime(payment.createdAtIso)} · {payment.method} · {formatTryCurrency(payment.amount)}
                      {payment.note ? ` · ${payment.note}` : ""}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {lastFullReceipt && (
              <div className="rounded-xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] p-3">
                <p className="text-sm font-semibold text-[color:var(--ui-text-primary)]">
                  Hesap kapatildi ve yazdirma hazirlandi.
                </p>
                <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
                  Son fis: Masa {lastFullReceipt.tableNo} · {formatTryCurrency(lastFullReceipt.transactionTotal)}
                </p>
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => printReceiptInHiddenFrame(lastFullReceipt)}
                    className={buttonClasses({ variant: "secondary", size: "sm", className: "h-9 px-3" })}
                  >
                    Tekrar Yazdir
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </article>
    </section>
  );
}

