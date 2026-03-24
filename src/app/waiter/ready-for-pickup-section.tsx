"use client";

import React, { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Package } from "lucide-react";
import toast from "react-hot-toast";
import { setOrderDelivered } from "@/app/actions/set-order-delivered";

type Order = {
  id: number;
  table: { tableNo: number };
  totalPrice: string;
  readyAt: Date | null;
  deliveredAt: Date | null;
};

export default function ReadyForPickupSection({
  orders,
}: {
  orders: Order[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  if (orders.length === 0) return null;

  const handleDelivered = (orderId: number) => {
    startTransition(async () => {
      const result = await setOrderDelivered(orderId);
      if (result.success) {
        toast.success("Teslim edildi olarak işaretlendi.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Bir hata oluştu");
      }
    });
  };

  return (
    <section className="waiter-section rounded-2xl p-4">
      <div className="waiter-top-strip mb-3 flex items-center justify-between gap-3 px-3 py-2.5">
        <h2 className="flex items-center gap-2 text-base font-semibold text-[color:var(--ui-text-primary)]">
          <Package className="h-5 w-5 text-[color:var(--ui-success)]" />
          Hazır – Teslim bekleyenler
        </h2>
        <span className="waiter-status-chip-success inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold">
          {orders.length} sipariş
        </span>
      </div>
      <p className="mb-3 text-sm text-[color:var(--ui-text-secondary)]">
        Mutfakta hazır olan siparişleri hızlıca teslim edip akışı tamamlayın.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {orders.map((order) => (
          <div
            key={order.id}
            className="waiter-card flex items-center justify-between rounded-xl px-4 py-3"
          >
            <div>
              <p className="font-bold text-neutral-900">
                Masa {order.table.tableNo}
              </p>
              <p className="text-sm text-neutral-600">
                #{order.id} • {order.totalPrice} ₺
              </p>
            </div>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleDelivered(order.id)}
              className="flex items-center gap-1.5 rounded-xl bg-[color:var(--ui-primary)] px-3 py-2 text-sm font-semibold text-white shadow hover:bg-[color:var(--ui-primary-hover)] disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              Teslim edildi
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
