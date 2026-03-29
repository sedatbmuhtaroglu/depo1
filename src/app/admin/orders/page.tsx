import React from "react";
import { prisma } from "@/lib/prisma";
import OrderList from "./order-list";
import { requireManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { STAFF_VISIBLE_ORDER_FILTER } from "@/lib/order-payment-visibility";

type StoredOrderItem = {
  productId: number;
  quantity: number;
  price: number;
};

export const dynamic = "force-dynamic";

export default async function AdminOrdersPage() {
  await requireManagerSession();
  const { tenantId } = await getCurrentTenantOrThrow();

  const orders = await prisma.order.findMany({
    where: {
      table: { restaurant: { tenantId } },
      AND: [STAFF_VISIBLE_ORDER_FILTER],
    },
    include: {
      table: true,
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const products = await prisma.product.findMany({
    where: { category: { restaurant: { tenantId } } },
    select: { id: true, nameTR: true },
  });

  const statusWeight = {
    PENDING_WAITER_APPROVAL: 1,
    PENDING: 2,
    PREPARING: 3,
    COMPLETED: 4,
    REJECTED: 5,
  } as const;

  const sortedOrders = [...orders].sort((a, b) => {
    if (statusWeight[a.status] !== statusWeight[b.status]) {
      return statusWeight[a.status] - statusWeight[b.status];
    }

    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const productMap = products.reduce((acc, current) => {
    acc[current.id] = current.nameTR;
    return acc;
  }, {} as Record<number, string>);

  const cleanOrders = sortedOrders.map((order) => ({
    ...order,
    totalPrice: order.totalPrice.toString(),
    items: (order.items as StoredOrderItem[]).map((item) => ({
      ...item,
      productName: productMap[item.productId] || "Silinmis / Bilinmeyen Urun",
    })),
  }));

  return (
    <div className="min-h-screen bg-neutral-100 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="bg-gradient-to-r from-neutral-900 to-neutral-600 bg-clip-text text-3xl font-bold text-transparent">
            Mutfak Paneli
          </h1>
          <p className="mt-2 text-neutral-500">
            Aktif siparişleri buradan yönetebilir, mutfak durumunu guncelleyebilirsiniz.
          </p>
        </div>

        <OrderList initialOrders={cleanOrders} />
      </div>
    </div>
  );
}

