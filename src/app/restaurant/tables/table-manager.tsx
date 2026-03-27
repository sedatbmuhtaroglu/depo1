"use client";

import React, { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import {
  ClipboardList,
  LayoutGrid,
  ListFilter,
  Power,
  Printer,
  QrCode,
  Receipt,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";
import { createTable } from "@/app/actions/create-table";
import { toggleTableActive } from "@/app/actions/toggle-table-active";
import {
  badgeClasses,
  buttonClasses,
  cardClasses,
  fieldClasses,
  selectClasses,
} from "@/lib/ui/button-variants";
import { isRestaurantPathFeatureEnabled } from "@/lib/restaurant-panel-access";
import { getClosedFeatureMessage } from "@/lib/tenant-feature-enforcement";

type Restaurant = { id: number; name: string };
type TableRow = {
  id: number;
  tableNo: number;
  publicCode: string;
  isActive: boolean;
  restaurantId: number;
  restaurantName: string;
  hasActiveOrders: boolean;
  hasOpenBillRequest: boolean;
  hasOpenWaiterCall: boolean;
  isBlocked: boolean;
  outstandingAmount: number;
};

type StatusFilter =
  | "ALL"
  | "ATTENTION"
  | "OPEN"
  | "CLOSED"
  | "ACTIVE_ORDER"
  | "BILL"
  | "CALL"
  | "BLOCKED";

const PANEL_CARD_CLASS = cardClasses({ className: "p-4 sm:p-5" });
const INPUT_CLASS = fieldClasses({ size: "md" });
const SELECT_CLASS = selectClasses({ size: "md" });
const FIELD_LABEL_CLASS =
  "mb-1 block text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(value);
}

function tablePriority(table: TableRow) {
  if (table.isBlocked) return 0;
  if (table.hasOpenBillRequest || table.hasOpenWaiterCall) return 1;
  if (table.hasActiveOrders) return 2;
  if (table.isActive) return 3;
  return 4;
}

function tableMatchesFilter(table: TableRow, filter: StatusFilter) {
  if (filter === "ALL") return true;
  if (filter === "ATTENTION") {
    return table.isBlocked || table.hasOpenBillRequest || table.hasOpenWaiterCall;
  }
  if (filter === "OPEN") return table.isActive;
  if (filter === "CLOSED") return !table.isActive;
  if (filter === "ACTIVE_ORDER") return table.hasActiveOrders;
  if (filter === "BILL") return table.hasOpenBillRequest;
  if (filter === "CALL") return table.hasOpenWaiterCall;
  if (filter === "BLOCKED") return table.isBlocked;
  return true;
}

function tableCardTone(table: TableRow): "default" | "subtle" | "warning" | "danger" | "success" {
  if (table.isBlocked) return "danger";
  if (table.hasOpenBillRequest || table.hasOpenWaiterCall) return "warning";
  if (table.hasActiveOrders) return "success";
  if (!table.isActive) return "subtle";
  return "default";
}

function tableSignalSummary(table: TableRow): string {
  const notes: string[] = [];
  if (table.isBlocked) notes.push("Blokeli");
  if (table.hasOpenBillRequest) notes.push("Ödeme açık");
  if (table.hasOpenWaiterCall) notes.push("Garson çağrısı var");
  if (table.hasActiveOrders) notes.push("Sipariş açık");
  return notes.length > 0 ? notes.join(" • ") : "Masa boş";
}

function tableOperationalState(table: TableRow): string {
  if (table.isBlocked) return "Blokeli";
  if (!table.isActive) return "Masa kapalı";
  if (table.hasActiveOrders) return "Siparişte";
  return "Masa boş";
}

export default function TableManager({
  enabledFeatures,
  restaurants,
  tables,
}: {
  enabledFeatures: string[];
  restaurants: Restaurant[];
  tables: TableRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [tableNo, setTableNo] = useState("");
  const [restaurantId, setRestaurantId] = useState(restaurants[0]?.id ?? 0);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [compactView, setCompactView] = useState(false);
  const enabledFeatureSet = useMemo(() => new Set(enabledFeatures), [enabledFeatures]);

  const counts = useMemo(() => {
    const open = tables.filter((table) => table.isActive).length;
    const attention = tables.filter(
      (table) => table.isBlocked || table.hasOpenBillRequest || table.hasOpenWaiterCall,
    ).length;
    const blocked = tables.filter((table) => table.isBlocked).length;
    const activeOrders = tables.filter((table) => table.hasActiveOrders).length;
    return {
      total: tables.length,
      open,
      attention,
      blocked,
      activeOrders,
    };
  }, [tables]);

  const filteredTables = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return [...tables]
      .sort((a, b) => {
        const priorityDiff = tablePriority(a) - tablePriority(b);
        if (priorityDiff !== 0) return priorityDiff;
        return a.tableNo - b.tableNo;
      })
      .filter((table) => {
        if (!tableMatchesFilter(table, statusFilter)) return false;
        if (!query) return true;
        const haystack = `masa ${table.tableNo} ${table.restaurantName}`.toLowerCase();
        return haystack.includes(query);
      });
  }, [tables, searchTerm, statusFilter]);

  const canOpenOrders = useMemo(
    () =>
      isRestaurantPathFeatureEnabled({
        pathname: "/restaurant/orders",
        enabledFeatures: enabledFeatureSet,
      }),
    [enabledFeatureSet],
  );

  const canOpenBilling = useMemo(
    () =>
      isRestaurantPathFeatureEnabled({
        pathname: "/restaurant/invoicing",
        enabledFeatures: enabledFeatureSet,
      }),
    [enabledFeatureSet],
  );

  const handleProtectedNavigation = (
    event: MouseEvent<HTMLAnchorElement>,
    allowed: boolean,
  ) => {
    if (allowed) return;
    event.preventDefault();
    event.stopPropagation();
    toast.error(getClosedFeatureMessage());
  };

  const handleAddTable = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number.parseInt(tableNo, 10);
    if (Number.isNaN(num) || num < 1) {
      toast.error("Geçerli bir masa numarası girin.");
      return;
    }

    startTransition(async () => {
      const result = await createTable(restaurantId, num);
      if (result.success) {
        toast.success("Masa eklendi.");
        setTableNo("");
        router.refresh();
      } else {
        toast.error(result.message ?? "Masa eklenemedi.");
      }
    });
  };

  const handleToggle = (tableId: number, isActive: boolean, hasActiveOrders: boolean) => {
    if (!isActive && hasActiveOrders) {
      toast.error("Aktif siparişler varken masa kapatılamaz.");
      return;
    }

    startTransition(async () => {
      const result = await toggleTableActive(tableId, !isActive);
      if (result.success) {
        toast.success(isActive ? "Masa kapatıldı." : "Masa açıldı.");
        router.refresh();
      } else {
        toast.error(result.message ?? "İşlem başarısız.");
      }
    });
  };

  return (
    <div className="space-y-5">
      <section className={PANEL_CARD_CLASS}>
        <div className="grid gap-3 xl:grid-cols-2">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="relative block sm:col-span-2 lg:col-span-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--ui-text-secondary)]" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Masa veya restoran ara"
                className={`${INPUT_CLASS} pl-9`}
              />
            </label>

            <label className="block">
              <span className={FIELD_LABEL_CLASS}>
                Durum filtresi
              </span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className={SELECT_CLASS}
              >
                <option value="ALL">Tüm masalar</option>
                <option value="ATTENTION">İnceleme gereken</option>
                <option value="OPEN">Masa açık</option>
                <option value="CLOSED">Masa kapalı</option>
                <option value="ACTIVE_ORDER">Sipariş açık</option>
                <option value="BILL">Ödeme açık</option>
                <option value="CALL">Garson çağırdı</option>
                <option value="BLOCKED">Blokeli</option>
              </select>
            </label>

            <div className="min-w-0">
              <span className={FIELD_LABEL_CLASS}>
                Görünüm
              </span>
              <div className="inline-flex w-full rounded-xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] p-1">
                <button
                  type="button"
                  onClick={() => setCompactView(false)}
                  className={buttonClasses({
                    variant: !compactView ? "secondary" : "ghost",
                    size: "xs",
                    className: "h-7 flex-1 px-2",
                  })}
                >
                  <LayoutGrid className="h-3.5 w-3.5" />
                  Konforlu
                </button>
                <button
                  type="button"
                  onClick={() => setCompactView(true)}
                  className={buttonClasses({
                    variant: compactView ? "secondary" : "ghost",
                    size: "xs",
                    className: "h-7 flex-1 px-2",
                  })}
                >
                  <ListFilter className="h-3.5 w-3.5" />
                  Kompakt
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-2">
            <SummaryTile label="Toplam" value={counts.total} />
            <SummaryTile label="Aciliyet" value={counts.attention} tone="warning" />
            <SummaryTile label="Masa açık" value={counts.open} tone="success" />
            <SummaryTile label="Sipariş açık" value={counts.activeOrders} tone="info" />
          </div>
        </div>

        <form
          onSubmit={handleAddTable}
          className={`${cardClasses({ tone: "subtle", className: "mt-4 p-3" })} grid gap-3 sm:grid-cols-2 lg:grid-cols-3`}
        >
          <label className="block">
            <span className={FIELD_LABEL_CLASS}>
              Restoran
            </span>
            <select
              value={restaurantId}
              onChange={(e) => setRestaurantId(Number(e.target.value))}
              className={SELECT_CLASS}
            >
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={FIELD_LABEL_CLASS}>
              Masa no
            </span>
            <input
              type="number"
              min={1}
              value={tableNo}
              onChange={(e) => setTableNo(e.target.value)}
              placeholder="Örn. 12"
              className={INPUT_CLASS}
            />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isPending}
              className={buttonClasses({ variant: "primary", size: "md", className: "h-10 w-full" })}
            >
              Masa ekle
            </button>
          </div>
        </form>
      </section>

      <section className={PANEL_CARD_CLASS}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-[color:var(--ui-text-primary)]">Masa Operasyon Kartları</h3>
          <span className="text-xs text-[color:var(--ui-text-secondary)]">
            {filteredTables.length} / {tables.length} masa
          </span>
        </div>

        {filteredTables.length === 0 ? (
          <div className={cardClasses({ tone: "subtle", className: "px-4 py-8 text-center" })}>
            <div className="mx-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-bg)] text-[color:var(--ui-text-secondary)]">
              <Search className="h-4 w-4" />
            </div>
            <p className="mt-2 text-sm font-semibold text-[color:var(--ui-text-primary)]">
              Bu kriterlerde masa görünmüyor
            </p>
            <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
              Filtreyi değiştirip tekrar bakabilirsiniz.
            </p>
          </div>
        ) : (
          <div
            className={
              compactView
                ? "grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                : "grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
            }
          >
            {filteredTables.map((table) => {
              const signalSummary = tableSignalSummary(table);
              const stateSummary = tableOperationalState(table);

              return (
                <article
                  key={table.id}
                  className={cardClasses({
                    tone: tableCardTone(table),
                    className: compactView ? "px-3 py-3" : "px-3.5 py-3.5",
                  })}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                        Masa
                      </p>
                      <p className="text-lg font-semibold text-[color:var(--ui-text-primary)]">{table.tableNo}</p>
                    </div>
                    <span className={badgeClasses(table.isActive ? "success" : "neutral")}>
                      {table.isActive ? "Masa açık" : "Masa kapalı"}
                    </span>
                  </div>

                  <p
                    className="mt-1 truncate text-xs text-[color:var(--ui-text-secondary)]"
                    title={table.restaurantName}
                  >
                    {table.restaurantName}
                  </p>

                  <p className="mt-2 text-xs text-[color:var(--ui-text-secondary)]">Operasyon: {signalSummary}</p>

                  <div className="mt-2.5 grid grid-cols-2 gap-2">
                    <div className={cardClasses({ tone: "subtle", className: "px-2.5 py-2" })}>
                      <p className="text-xs text-[color:var(--ui-text-secondary)]">Durum</p>
                      <p className="mt-0.5 text-xs font-semibold text-[color:var(--ui-text-primary)]">
                        {stateSummary}
                      </p>
                    </div>
                    <div className={cardClasses({ tone: "subtle", className: "px-2.5 py-2" })}>
                      <p className="text-xs text-[color:var(--ui-text-secondary)]">Kalan borç</p>
                      <p className="mt-0.5 text-xs font-semibold text-[color:var(--ui-text-primary)]">
                        {formatCurrency(table.outstandingAmount)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-1.5">
                    <Link
                      href="/restaurant/orders"
                      onClick={(event) => handleProtectedNavigation(event, canOpenOrders)}
                      className={buttonClasses({ variant: "secondary", size: "xs", className: "h-8" })}
                    >
                      <ClipboardList className="h-3.5 w-3.5" />
                      Sipariş
                    </Link>
                    <Link
                      href="/restaurant/invoicing"
                      onClick={(event) => handleProtectedNavigation(event, canOpenBilling)}
                      className={buttonClasses({ variant: "secondary", size: "xs", className: "h-8" })}
                    >
                      <Receipt className="h-3.5 w-3.5" />
                      Hesap
                    </Link>
                  </div>

                  <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                    <Link
                      href={`/restaurant/tables/qr/${table.id}`}
                      className={buttonClasses({ variant: "ghost", size: "xs", className: "h-8" })}
                    >
                      <QrCode className="h-3.5 w-3.5" />
                      QR
                    </Link>
                    <Link
                      href={`/restaurant/tables/qr/${table.id}?autoprint=1`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={buttonClasses({ variant: "ghost", size: "xs", className: "h-8" })}
                    >
                      <Printer className="h-3.5 w-3.5" />
                      Yazdır
                    </Link>
                  </div>

                  <div className="mt-1.5">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleToggle(table.id, table.isActive, table.hasActiveOrders)}
                      className={buttonClasses({
                        variant: table.isActive ? "secondary" : "primary",
                        size: "xs",
                        className: "h-8 w-full",
                      })}
                    >
                      <Power className="h-3.5 w-3.5" />
                      {table.isActive ? "Masayı kapat" : "Masayı aç"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number;
  tone?: "default" | "warning" | "info" | "success";
}) {
  const cardTone =
    tone === "warning"
      ? "warning"
      : tone === "success"
        ? "success"
        : tone === "info"
          ? "subtle"
          : "default";

  return (
    <div className={cardClasses({ tone: cardTone, className: "px-3 py-2" })}>
      <p className="text-xs font-medium text-[color:var(--ui-text-secondary)]">{label}</p>
      <p className="mt-0.5 text-base font-semibold text-[color:var(--ui-text-primary)]">{value}</p>
    </div>
  );
}
