"use client";

import React, { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import type { MenuShowcaseAutoplaySpeed } from "@prisma/client";
import toast from "react-hot-toast";
import {
  badgeClasses,
  buttonClasses,
  cardClasses,
  fieldClasses,
  helperTextClasses,
  labelClasses,
} from "@/lib/ui/button-variants";
import { PanelSelect } from "@/components/ui/panel-select";
import {
  MENU_SHOWCASE_MAX_ITEMS,
  isProductSelectableForMenuShowcase,
} from "@/lib/menu-showcase";
import { savePopularMenuShowcase } from "@/app/actions/menu-showcase";
import { ShowcaseMenuToolbar } from "./showcase-menu-toolbar";
import type { PopularInitialRow, ShowcaseCategoryRow } from "../_lib/load-showcase-admin-data";

type PopularRow = PopularInitialRow;

function productNameLookup(categories: ShowcaseCategoryRow[], id: number) {
  for (const c of categories) {
    const p = c.products.find((x) => x.id === id);
    if (p) return p.nameTR;
  }
  return `#${id}`;
}

function PopularShowcaseBlock({
  menuId,
  categoryId,
  initialRow,
  categories,
  isPending,
  startTransition,
}: {
  menuId: number;
  categoryId: number;
  initialRow: PopularRow | null;
  categories: ShowcaseCategoryRow[];
  isPending: boolean;
  startTransition: (fn: () => Promise<void>) => void;
}) {
  const now = useMemo(() => new Date(), []);
  const [title, setTitle] = useState(initialRow?.title ?? "Popüler seçimler");
  const [subtitle, setSubtitle] = useState(initialRow?.subtitle ?? "");
  const [enabled, setEnabled] = useState(initialRow?.isEnabled ?? false);
  const [order, setOrder] = useState<number[]>(initialRow?.productIds ?? []);
  const [autoplayEnabled, setAutoplayEnabled] = useState(initialRow?.autoplayEnabled ?? false);
  const [autoplaySpeed, setAutoplaySpeed] = useState<MenuShowcaseAutoplaySpeed>(
    initialRow?.autoplaySpeed ?? "SLOW",
  );

  const selectableInCategory = useMemo(() => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return [];
    return cat.products.filter((p) => isProductSelectableForMenuShowcase(p, now));
  }, [categories, categoryId, now]);

  const popularAddOptions = selectableInCategory.filter((p) => !order.includes(p.id));

  const move = (index: number, dir: -1 | 1) => {
    const n = index + dir;
    if (n < 0 || n >= order.length) return;
    const next = [...order];
    const t = next[index];
    next[index] = next[n]!;
    next[n] = t!;
    setOrder(next);
  };

  const addProduct = (productId: number) => {
    if (order.includes(productId)) return;
    if (order.length >= MENU_SHOWCASE_MAX_ITEMS) {
      toast.error(`En fazla ${MENU_SHOWCASE_MAX_ITEMS} ürün.`);
      return;
    }
    setOrder((o) => [...o, productId]);
  };

  const handleSave = () => {
    startTransition(async () => {
      const r = await savePopularMenuShowcase({
        menuId,
        categoryId,
        title,
        subtitle: subtitle.trim() || null,
        isEnabled: enabled,
        productIds: order,
        autoplayEnabled,
        autoplaySpeed,
      });
      if (r.success) toast.success("Popüler vitrin kaydedildi.");
      else toast.error(r.message ?? "Kaydedilemedi.");
    });
  };

  return (
    <div className={cardClasses({ tone: "subtle", className: "space-y-4 p-3.5 sm:p-4" })}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6B7280]">
            İçerik ve durum
          </p>
          <p className="mt-0.5 text-xs text-[#6B7280]">
            Yalnızca seçilen kategoride, müşteri menüsünde yatay vitrin olarak gösterilir.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-[#374151]">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 accent-[#14213D]"
          />
          Aktif
        </label>
      </div>

      <div className="grid gap-2">
        <div>
          <label className={labelClasses("text-xs")}>Başlık</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={fieldClasses({ size: "sm", className: "mt-1 w-full" })}
            maxLength={160}
          />
        </div>
        <div>
          <label className={labelClasses("text-xs")}>Alt açıklama</label>
          <textarea
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            className={fieldClasses({ size: "sm", className: "mt-1 min-h-[4rem] w-full resize-y" })}
            maxLength={320}
            rows={2}
          />
        </div>
      </div>

      <div className="rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] p-3">
        <p className="text-xs font-semibold text-[#111827]">Görünüm ve otomatik kaydırma</p>
        <p className={helperTextClasses()}>
          Kapalıyken müşteri yatay kaydırır. Açıkken yavaş bir döngü ile kayar; cihazda &quot;hareket
          azalt&quot; tercihi varsa otomatik kayma yine kullanılmaz.
        </p>
        <label className="mt-2 flex items-center gap-2 text-xs font-medium text-[#374151]">
          <input
            type="checkbox"
            checked={autoplayEnabled}
            onChange={(e) => setAutoplayEnabled(e.target.checked)}
            className="h-4 w-4 accent-[#14213D]"
          />
          Otomatik kaydırma
        </label>
        <div className="mt-2 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-xs text-[#374151]">
            <input
              type="radio"
              name="autoplay-speed"
              checked={autoplaySpeed === "SLOW"}
              disabled={!autoplayEnabled}
              onChange={() => setAutoplaySpeed("SLOW")}
              className="h-4 w-4 accent-[#14213D]"
            />
            Yavaş (önerilen)
          </label>
          <label className="flex items-center gap-2 text-xs text-[#374151]">
            <input
              type="radio"
              name="autoplay-speed"
              checked={autoplaySpeed === "NORMAL"}
              disabled={!autoplayEnabled}
              onChange={() => setAutoplaySpeed("NORMAL")}
              className="h-4 w-4 accent-[#14213D]"
            />
            Normal
          </label>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-[#374151]">Sıradaki ürünler (bu kategoriden)</p>
        {order.length === 0 ? (
          <p className={helperTextClasses()}>Henüz ürün eklenmedi.</p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {order.map((id, idx) => (
              <li
                key={id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-xs"
              >
                <span className="min-w-0 flex-1 truncate font-medium text-[#111827]">
                  {productNameLookup(categories, id)}
                </span>
                <span className="inline-flex shrink-0 gap-1">
                  <button
                    type="button"
                    className={buttonClasses({ variant: "outline", size: "xs", className: "px-2" })}
                    onClick={() => move(idx, -1)}
                    disabled={isPending || idx === 0}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={buttonClasses({ variant: "outline", size: "xs", className: "px-2" })}
                    onClick={() => move(idx, 1)}
                    disabled={isPending || idx === order.length - 1}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={buttonClasses({ variant: "danger", size: "xs", className: "px-2" })}
                    onClick={() => setOrder((o) => o.filter((x) => x !== id))}
                    disabled={isPending}
                  >
                    Kaldır
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <label className={labelClasses("text-xs")}>Ürün ekle</label>
        <PanelSelect
          key={order.join("-")}
          value=""
          onValueChange={(v) => {
            if (!v) return;
            addProduct(Number(v));
          }}
          aria-label="Popüler vitrine ürün ekle"
          options={[
            { value: "", label: "Ürün seçin…" },
            ...popularAddOptions.map((p) => ({
              value: p.id,
              label: p.nameTR,
            })),
          ]}
        />
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className={buttonClasses({
          variant: "primary",
          size: "sm",
          className: "w-full sm:w-auto",
        })}
      >
        Kaydet
      </button>
    </div>
  );
}

export default function PopularShowcaseManager({
  menus,
  selectedMenuId,
  categories,
  initialPopular,
}: {
  menus: Array<{ id: number; name: string; isActive: boolean }>;
  selectedMenuId: number | null;
  categories: ShowcaseCategoryRow[];
  initialPopular: PopularRow[];
}) {
  const [isPending, startTransition] = useTransition();
  const [popularCategoryId, setPopularCategoryId] = useState<number | "">(
    () => categories[0]?.id ?? "",
  );

  const popularInitialRow =
    popularCategoryId === ""
      ? null
      : initialPopular.find((p) => p.categoryId === popularCategoryId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link
            href="/restaurant/menu"
            className="text-xs font-medium text-[#6B7280] underline-offset-2 hover:text-[#111827] hover:underline"
          >
            ← Menü yönetimine dön
          </Link>
          <h2 className="mt-2 text-lg font-semibold text-[#111827]">Popüler Ürünler</h2>
          <p className="mt-1 text-sm text-[#6B7280]">
            Kategori bazlı vitrin; müşteri menüsünde yalnızca ilgili kategoride görünür.
          </p>
        </div>
        <span className={badgeClasses("neutral")}>En fazla {MENU_SHOWCASE_MAX_ITEMS} ürün</span>
      </div>

      <div className={cardClasses({ className: "p-4 sm:p-5" })}>
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6B7280]">Menü seçimi</p>
        <div className="mt-2">
          <ShowcaseMenuToolbar menus={menus} selectedMenuId={selectedMenuId} />
        </div>
        {!selectedMenuId ? (
          <p className="mt-3 text-sm text-[#6B7280]">
            Vitrin atamak için önce bir menü seçin veya{" "}
            <Link href="/restaurant/menu" className="font-medium text-[#111827] underline">
              menü yönetimine
            </Link>{" "}
            gidin.
          </p>
        ) : null}
      </div>

      {selectedMenuId && categories.length === 0 ? (
        <div className={cardClasses({ tone: "subtle", className: "px-4 py-8 text-center" })}>
          <p className="text-sm font-medium text-[#111827]">Bu menüde kategori yok</p>
          <p className={helperTextClasses()}>
            Önce kategori ve ürün ekleyin; ardından vitrin oluşturabilirsiniz.
          </p>
        </div>
      ) : null}

      {selectedMenuId && categories.length > 0 ? (
        <div className="space-y-3">
          <div>
            <label className={labelClasses("text-xs")}>Kategori</label>
            <PanelSelect
              value={popularCategoryId === "" ? "" : String(popularCategoryId)}
              onValueChange={(v) => setPopularCategoryId(v === "" ? "" : Number(v))}
              aria-label="Popüler vitrin kategorisi"
              options={categories.map((c) => ({
                value: c.id,
                label: c.nameTR,
              }))}
            />
          </div>
          {popularCategoryId === "" ? (
            <p className={helperTextClasses()}>Kategori seçin.</p>
          ) : (
            <PopularShowcaseBlock
              key={`${selectedMenuId}-${popularCategoryId}`}
              menuId={selectedMenuId}
              categoryId={Number(popularCategoryId)}
              initialRow={popularInitialRow}
              categories={categories}
              isPending={isPending}
              startTransition={startTransition}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
