"use client";

import React, { useEffect, useMemo, useState, useTransition } from "react";
import { Clock3, XCircle } from "lucide-react";
import toast from "react-hot-toast";
import { updateOrderStatus } from "@/app/actions/update-order-status";
import { badgeClasses, buttonClasses, cardClasses } from "@/lib/ui/button-variants";

type RestaurantOrder = {
  id: number;
  table: { tableNo: number };
  totalPrice: string;
  status:
    | "PENDING_WAITER_APPROVAL"
    | "PENDING"
    | "PREPARING"
    | "COMPLETED"
    | "REJECTED";
  createdAt: Date;
  preparingStartedAt?: Date | null;
};

type Props = {
  waitingApproval: RestaurantOrder[];
  activeOrders: RestaurantOrder[];
  rejectedOrders: RestaurantOrder[];
};

const SECTION_CARD_CLASS = cardClasses({ className: "p-4 sm:p-5" });

function formatCurrency(value: string | number) {
  const num = typeof value === "string" ? Number(value) : value;
  if (Number.isNaN(num)) return "-";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(num);
}

function formatTime(date: Date) {
  return new Date(date).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul",
  });
}

function getPreparingDurationMinutes(
  preparingStartedAt: Date | null | undefined,
  nowMs: number,
) {
  if (!preparingStartedAt) return null;
  const startedAt = new Date(preparingStartedAt).getTime();
  if (Number.isNaN(startedAt)) return null;
  const diff = nowMs - startedAt;
  if (diff < 0) return 0;
  return Math.floor(diff / 60000);
}

export default function RestaurantOrdersSection({
  waitingApproval,
  activeOrders,
  rejectedOrders,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    const immediate = window.setTimeout(() => setNowMs(Date.now()), 0);
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => {
      window.clearTimeout(immediate);
      window.clearInterval(timer);
    };
  }, []);

  const totalQueue = waitingApproval.length + activeOrders.length;
  const hasAnyOrder =
    waitingApproval.length > 0 || activeOrders.length > 0 || rejectedOrders.length > 0;

  const handleStatusChange = (
    orderId: number,
    status: "PENDING" | "PREPARING" | "COMPLETED" | "REJECTED",
  ) => {
    startTransition(async () => {
      const result = await updateOrderStatus(orderId, status);
      if (result.success) {
        toast.success(`Siparis #${orderId} guncellendi.`);
      } else {
        toast.error(result.message || "Guncelleme basarisiz.");
      }
    });
  };

  const waitingTitle = useMemo(
    () => `Onay bekleyenler (${waitingApproval.length})`,
    [waitingApproval.length],
  );
  const activeTitle = useMemo(
    () => `Aktif siparisler (${activeOrders.length})`,
    [activeOrders.length],
  );
  const rejectedTitle = useMemo(
    () => `Iptal edilenler (${rejectedOrders.length})`,
    [rejectedOrders.length],
  );

  return (
    <section className={SECTION_CARD_CLASS}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-[color:var(--ui-border-subtle)] pb-4">
        <div>
          <h3 className="text-base font-semibold tracking-tight text-[color:var(--ui-text-primary)]">
            Canli siparis akisi
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-[color:var(--ui-text-secondary)]">
            Mutfak ve servis durumlarini tek listede takip edin.
          </p>
        </div>
        <span className="tabular-nums text-xs font-medium text-[color:var(--ui-text-muted)]">
          Acik kuyruk: {totalQueue}
        </span>
      </div>

      {!hasAnyOrder && (
        <div className={cardClasses({ tone: "subtle", className: "px-4 py-5 text-center" })}>
          <div className="mx-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-bg)] text-[color:var(--ui-text-secondary)]">
            <Clock3 className="h-4 w-4" />
          </div>
          <p className="mt-2 text-sm font-semibold text-[color:var(--ui-text-primary)]">Aktif siparis yok</p>
          <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
            Yeni siparis geldiginde bu alan otomatik guncellenir.
          </p>
        </div>
      )}

      <div className="space-y-3.5">
        {waitingApproval.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-warning)]">
              {waitingTitle}
            </h4>
            <div className="space-y-2">
              {waitingApproval.map((order) => (
                <article key={order.id} className={cardClasses({ tone: "warning", className: "px-3 py-3" })}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[color:var(--ui-text-primary)]">
                          Masa {order.table.tableNo}
                        </p>
                        <span className="text-xs text-[color:var(--ui-text-secondary)]">#{order.id}</span>
                      </div>
                      <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
                        {formatTime(order.createdAt)} • {formatCurrency(order.totalPrice)}
                      </p>
                      {order.preparingStartedAt && (
                        <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
                          Hazirlik baslangici: {formatTime(order.preparingStartedAt)} •{" "}
                          {getPreparingDurationMinutes(order.preparingStartedAt, nowMs) ?? 0} dk
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <span className={badgeClasses("warning")}>Garson onayi bekliyor</span>
                      <button
                        disabled={isPending}
                        onClick={() => handleStatusChange(order.id, "REJECTED")}
                        className={buttonClasses({ variant: "danger", size: "xs", className: "h-8" })}
                      >
                        Reddet
                      </button>
                      <button
                        disabled={isPending}
                        onClick={() => handleStatusChange(order.id, "PENDING")}
                        className={buttonClasses({ variant: "primary", size: "xs", className: "h-8" })}
                      >
                        Onayla
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {activeOrders.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
              {activeTitle}
            </h4>
            <div className="space-y-2">
              {activeOrders.map((order) => (
                <article key={order.id} className={cardClasses({ className: "px-3 py-3" })}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[color:var(--ui-text-primary)]">
                          Masa {order.table.tableNo}
                        </p>
                        <span className="text-xs text-[color:var(--ui-text-secondary)]">#{order.id}</span>
                      </div>
                      <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
                        {formatTime(order.createdAt)} • {formatCurrency(order.totalPrice)}
                      </p>
                      {order.preparingStartedAt && (
                        <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
                          Hazirlik baslangici: {formatTime(order.preparingStartedAt)} •{" "}
                          {getPreparingDurationMinutes(order.preparingStartedAt, nowMs) ?? 0} dk
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <span className={badgeClasses(order.status === "PREPARING" ? "info" : "neutral")}>
                        {order.status === "PREPARING" ? "Hazirlaniyor" : "Bekliyor"}
                      </span>
                      {order.status === "PENDING" && (
                        <button
                          disabled={isPending}
                          onClick={() => handleStatusChange(order.id, "PREPARING")}
                          className={buttonClasses({ variant: "secondary", size: "xs", className: "h-8" })}
                        >
                          Hazirlaniyor
                        </button>
                      )}
                      {order.status === "PREPARING" && (
                        <button
                          disabled={isPending}
                          onClick={() => handleStatusChange(order.id, "COMPLETED")}
                          className={buttonClasses({ variant: "success", size: "xs", className: "h-8" })}
                        >
                          Tamamla
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}

        {rejectedOrders.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-danger)]">
              {rejectedTitle}
            </h4>
            <div className="space-y-2">
              {rejectedOrders.map((order) => (
                <article key={order.id} className={cardClasses({ tone: "danger", className: "px-3 py-3" })}>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-[color:var(--ui-text-primary)]">
                          Masa {order.table.tableNo}
                        </p>
                        <span className="text-xs text-[color:var(--ui-text-secondary)]">#{order.id}</span>
                      </div>
                      <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
                        {formatTime(order.createdAt)} • {formatCurrency(order.totalPrice)}
                      </p>
                    </div>
                    <span className={badgeClasses("danger")}>
                      <XCircle className="h-3.5 w-3.5" /> Iptal edildi
                    </span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
