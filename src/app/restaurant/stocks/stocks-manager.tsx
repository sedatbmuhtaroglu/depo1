"use client";

import React, { useMemo, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { updateProductStock } from "@/app/actions/update-product-stock";
import { PanelSelect } from "@/components/ui/panel-select";
import {
  badgeClasses,
  buttonClasses,
  cardClasses,
  checkboxControlClasses,
  checkboxInputClasses,
  checkboxLabelClasses,
  fieldClasses,
} from "@/lib/ui/button-variants";

type Category = {
  id: number;
  nameTR: string;
};

type Product = {
  id: number;
  nameTR: string;
  isAvailable: boolean;
  trackStock: boolean;
  stockQuantity: number;
  updatedAt: string;
  isOutOfStock: boolean;
  category: {
    id: number;
    nameTR: string;
  };
};

const LOW_STOCK_THRESHOLD = 5;

const PANEL_CARD_CLASS = cardClasses({ className: "p-4 sm:p-5" });
const TABLE_CARD_CLASS = cardClasses({ className: "overflow-hidden p-0" });
const INPUT_CLASS = fieldClasses({ size: "md" });
const STOCK_INPUT_CLASS = fieldClasses({ size: "sm" });

export default function StocksManager({
  categories,
  products,
}: {
  categories: Category[];
  products: Product[];
}) {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<"all" | number>("all");
  const [onlyLowStock, setOnlyLowStock] = useState(false);
  const [onlyTracked, setOnlyTracked] = useState(false);

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr-TR");
    return products.filter((product) => {
      if (categoryId !== "all" && product.category.id !== categoryId) return false;
      if (onlyTracked && !product.trackStock) return false;
      if (onlyLowStock) {
        if (!product.trackStock) return false;
        if (product.stockQuantity > LOW_STOCK_THRESHOLD) return false;
      }
      if (!term) return true;
      return (
        product.nameTR.toLocaleLowerCase("tr-TR").includes(term) ||
        product.category.nameTR.toLocaleLowerCase("tr-TR").includes(term)
      );
    });
  }, [products, search, categoryId, onlyLowStock, onlyTracked]);

  const trackedVisibleCount = filteredProducts.filter((product) => product.trackStock).length;
  const lowStockVisibleCount = filteredProducts.filter(
    (product) => product.trackStock && product.stockQuantity <= LOW_STOCK_THRESHOLD,
  ).length;

  return (
    <div className="space-y-4">
      <section className={PANEL_CARD_CLASS}>
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2.5">
          <div>
            <h3 className="text-sm font-semibold text-[#111827]">Filtre ve Araçlar</h3>
            <p className="mt-1 text-xs text-[#6B7280]">
              Arama ve filtrelerle stok operasyonunu hızlı şekilde daraltın.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={badgeClasses("neutral")}>{filteredProducts.length} ürün</span>
            <span className={badgeClasses("info")}>{trackedVisibleCount} takip açık</span>
            <span className={badgeClasses("warning")}>{lowStockVisibleCount} düşük stok</span>
          </div>
        </div>

        <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1fr)_240px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ürün veya kategori ara"
              className={`${INPUT_CLASS} pl-9`}
            />
          </label>

          <PanelSelect
            value={categoryId === "all" ? "all" : String(categoryId)}
            onValueChange={(nextValue) =>
              setCategoryId(nextValue === "all" ? "all" : Number(nextValue))
            }
            aria-label="Kategori filtresi"
            options={[
              { value: "all", label: "Tüm kategoriler" },
              ...categories.map((category) => ({
                value: category.id,
                label: category.nameTR,
              })),
            ]}
          />
        </div>

        <div className="mt-2.5 grid gap-2.5 md:grid-cols-2">
          <label
            className={checkboxControlClasses({
              checked: onlyLowStock,
              className: "justify-between gap-2.5",
            })}
          >
            <span className={checkboxLabelClasses()}>
              Düşük stok (&lt;= {LOW_STOCK_THRESHOLD})
            </span>
            <input
              type="checkbox"
              checked={onlyLowStock}
              onChange={(event) => setOnlyLowStock(event.target.checked)}
              className={checkboxInputClasses()}
            />
          </label>
          <label
            className={checkboxControlClasses({
              checked: onlyTracked,
              className: "justify-between gap-2.5",
            })}
          >
            <span className={checkboxLabelClasses()}>Sadece stok takibi açık</span>
            <input
              type="checkbox"
              checked={onlyTracked}
              onChange={(event) => setOnlyTracked(event.target.checked)}
              className={checkboxInputClasses()}
            />
          </label>
        </div>
      </section>

      <section className={TABLE_CARD_CLASS}>
        <div className="overflow-x-auto">
          <table className="min-w-[960px] w-full text-sm">
            <thead>
              <tr className="border-b border-[#E6EAF0] bg-[#F8FAFC]">
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.09em] text-[#6B7280]">
                  Ürün
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.09em] text-[#6B7280]">
                  Kategori
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.09em] text-[#6B7280]">
                  Durum
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.09em] text-[#6B7280]">
                  Stok Takibi
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.09em] text-[#6B7280]">
                  Stok Adedi
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.09em] text-[#6B7280]">
                  Son Güncelleme
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.09em] text-[#6B7280]">
                  İşlem
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <p className="text-sm font-semibold text-[#111827]">Filtreye uygun ürün bulunamadı</p>
                    <p className="mt-1 text-xs text-[#6B7280]">
                      Arama veya filtreleri değiştirerek tekrar deneyin.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => <StockRow key={product.id} product={product} />)
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StockRow({ product }: { product: Product }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [trackStock, setTrackStock] = useState(product.trackStock);
  const [stockQuantity, setStockQuantity] = useState(String(product.stockQuantity));

  const isLowStock = trackStock && Number(stockQuantity) <= LOW_STOCK_THRESHOLD;
  const isOutOfStock = !product.isAvailable || (trackStock && Number(stockQuantity) <= 0);

  const updatedAtDate = new Date(product.updatedAt);
  const updatedAtDateLabel = updatedAtDate.toLocaleDateString("tr-TR");
  const updatedAtTimeLabel = updatedAtDate.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleSave = () => {
    startTransition(async () => {
      const parsedQuantity = Math.max(0, Math.floor(Number(stockQuantity) || 0));
      const result = await updateProductStock({
        productId: product.id,
        trackStock,
        stockQuantity: parsedQuantity,
      });
      if (result.success) {
        toast.success("Stok güncellendi.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Stok güncellenemedi.");
      }
    });
  };

  return (
    <tr className="border-b border-[#EEF1F4] transition-colors hover:bg-[#FAFBFD]">
      <td className="px-4 py-3.5 align-top">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-[#111827]">{product.nameTR}</p>
          <p className="text-[11px] text-[#6B7280]">Ürün ID #{product.id}</p>
        </div>
      </td>

      <td className="px-4 py-3.5 align-top">
        <p className="text-sm text-[#374151]">{product.category.nameTR}</p>
      </td>

      <td className="px-4 py-3.5 align-top">
        <div className="flex flex-wrap gap-1.5">
          <span className={badgeClasses(isOutOfStock ? "danger" : "success")}>
            {isOutOfStock ? "Stokta yok" : "Aktif"}
          </span>
          {isLowStock && !isOutOfStock ? <span className={badgeClasses("warning")}>Düşük stok</span> : null}
        </div>
      </td>

      <td className="px-4 py-3.5 align-top">
        <label
          className={checkboxControlClasses({
            checked: trackStock,
            compact: true,
            className: "min-w-[172px]",
          })}
        >
          <input
            type="checkbox"
            checked={trackStock}
            onChange={(event) => setTrackStock(event.target.checked)}
            disabled={isPending}
            className={checkboxInputClasses()}
          />
          <span className={checkboxLabelClasses("text-[11px]")}>
            {trackStock ? "Takip açık" : "Takip kapalı / Sınırsız"}
          </span>
        </label>
      </td>

      <td className="px-4 py-3.5 align-top">
        <input
          type="number"
          min={0}
          step={1}
          value={stockQuantity}
          onChange={(event) => setStockQuantity(event.target.value)}
          disabled={isPending || !trackStock}
          className={`${STOCK_INPUT_CLASS} w-24 text-right font-semibold ${
            isLowStock ? "border-[#E9D1A8] bg-[#FFF8EC]" : ""
          }`}
        />
      </td>

      <td className="px-4 py-3.5 align-top">
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-[#374151]">{updatedAtDateLabel}</p>
          <p className="text-[11px] text-[#9CA3AF]">{updatedAtTimeLabel}</p>
        </div>
      </td>

      <td className="px-4 py-3.5 align-top">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className={buttonClasses({
            variant: "primary",
            size: "sm",
            className: "min-w-[84px] px-3",
          })}
        >
          {isPending ? "Kaydediliyor" : "Kaydet"}
        </button>
      </td>
    </tr>
  );
}
