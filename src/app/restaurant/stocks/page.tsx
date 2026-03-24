import React from "react";
import { prisma } from "@/lib/prisma";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import StocksManager from "./stocks-manager";

export const dynamic = "force-dynamic";

const LOW_STOCK_THRESHOLD = 5;

export default async function RestaurantStocksPage() {
  const { tenantId } = await getCurrentTenantOrThrow();

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      where: {
        category: {
          restaurant: { tenantId },
        },
      },
      select: {
        id: true,
        nameTR: true,
        isAvailable: true,
        trackStock: true,
        stockQuantity: true,
        updatedAt: true,
        category: {
          select: {
            id: true,
            nameTR: true,
          },
        },
      },
      orderBy: [{ categoryId: "asc" }, { nameTR: "asc" }],
    }),
    prisma.category.findMany({
      where: {
        restaurant: { tenantId },
      },
      select: { id: true, nameTR: true },
      orderBy: { nameTR: "asc" },
    }),
  ]);

  const totalProducts = products.length;
  const trackedProducts = products.filter((product) => product.trackStock).length;
  const lowStockProducts = products.filter(
    (product) => product.trackStock && product.stockQuantity <= LOW_STOCK_THRESHOLD,
  ).length;

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[#E8EBF0] bg-[#FFFFFF] p-4 shadow-[0_1px_3px_rgba(17,24,39,0.035)] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[#6B7280]">
              Stok Yönetimi
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#111827]">Stoklar</h2>
            <p className="mt-1 text-sm text-[#6B7280]">
              Ürün stok durumunu, takip ayarlarını ve stok adetlerini tek ekranda yönetin.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-[#E5E7EB] bg-[#F9FAFB] px-2.5 py-1 text-xs font-medium text-[#6B7280]">
            {categories.length} kategori
          </span>
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          <div className="rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-[0.1em] text-[#6B7280]">Toplam Ürün</p>
            <p className="mt-1 text-lg font-semibold text-[#111827]">{totalProducts}</p>
          </div>
          <div className="rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-[0.1em] text-[#6B7280]">
              Stok Takibi Açık
            </p>
            <p className="mt-1 text-lg font-semibold text-[#111827]">{trackedProducts}</p>
          </div>
          <div className="rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] px-3 py-2.5">
            <p className="text-[11px] uppercase tracking-[0.1em] text-[#6B7280]">Düşük Stoklu</p>
            <p className="mt-1 text-lg font-semibold text-[#111827]">{lowStockProducts}</p>
          </div>
        </div>
      </section>

      <StocksManager
        categories={categories}
        products={products.map((product) => ({
          id: product.id,
          nameTR: product.nameTR,
          isAvailable: product.isAvailable,
          trackStock: product.trackStock,
          stockQuantity: product.stockQuantity,
          updatedAt: product.updatedAt.toISOString(),
          category: {
            id: product.category.id,
            nameTR: product.category.nameTR,
          },
          isOutOfStock: !product.isAvailable || (product.trackStock && product.stockQuantity <= 0),
        }))}
      />
    </div>
  );
}
