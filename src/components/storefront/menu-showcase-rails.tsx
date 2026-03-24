"use client";

import Image from "next/image";
import { Plus, Sparkles, UtensilsCrossed } from "lucide-react";
import { useSyncExternalStore } from "react";
import type { StorefrontAutoplaySpeed, StorefrontFrequentPlacement } from "@/lib/storefront-menu-showcase-resolve";

/** Menü `Product` tipi ile uyumlu minimal kesit (vitrin kartı). */
export type ShowcaseProductMinimal = {
  id: number;
  categoryId: number;
  nameTR: string;
  nameEN: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  trackStock?: boolean;
  stockQuantity?: number;
  isFeatured?: boolean;
};

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof window === "undefined") return () => {};
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}

function ShowcaseCard<T extends ShowcaseProductMinimal>({
  product,
  displayName,
  orderingClosed,
  outOfStock,
  onAdd,
  accentVar,
}: {
  product: T;
  displayName: string;
  orderingClosed: boolean;
  outOfStock: boolean;
  onAdd: () => void;
  accentVar: string;
}) {
  return (
    <article
      className={`storefront-showcase-card relative flex w-[9.75rem] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-[#e8dfd2] bg-[#fffaf4] shadow-[0_8px_24px_rgba(23,20,16,0.06)] sm:w-[10.25rem] ${
        outOfStock ? "opacity-[0.72]" : ""
      }`}
    >
      <div className="relative aspect-[4/3] w-full bg-[#f3ebe0]">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt=""
            fill
            className="object-cover"
            sizes="164px"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#d9cfc3] bg-[#fffcf7] shadow-sm">
              <UtensilsCrossed className="h-5 w-5 text-[#9a7a52]" strokeWidth={2} aria-hidden />
            </div>
          </div>
        )}
        {outOfStock ? (
          <span className="absolute left-1.5 top-1.5 rounded-full border border-red-200/90 bg-red-50 px-1.5 py-px text-[8px] font-bold uppercase tracking-wide text-red-700">
            Stokta yok
          </span>
        ) : product.isFeatured ? (
          <span
            className="absolute left-1.5 top-1.5 inline-flex items-center gap-0.5 rounded-full border border-[#e8dfd2] bg-[#fffdf9]/95 px-1.5 py-px text-[8px] font-semibold uppercase tracking-wide text-[#5c4a38]"
            style={{ color: accentVar }}
          >
            <Sparkles className="h-2.5 w-2.5" aria-hidden />
            Öne çıkan
          </span>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-2.5 pt-2">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-[0.8125rem] font-semibold leading-snug text-[#1a1814]">
          {displayName}
        </h3>
        <div className="mt-auto flex items-end justify-between gap-1 pt-2">
          <p className="text-sm font-bold tabular-nums text-[#1a1814]">
            {product.price.toFixed(2)} TL
          </p>
          {!outOfStock ? (
            <button
              type="button"
              onClick={onAdd}
              disabled={orderingClosed}
              className="storefront-product-add !px-2 !py-1 text-[11px]"
            >
              <Plus className="h-3 w-3" strokeWidth={2.5} aria-hidden />
              Ekle
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function StorefrontFrequentShowcaseSection<T extends ShowcaseProductMinimal>({
  title,
  subtitle,
  products,
  language,
  t,
  orderingClosed,
  isProductOutOfStock,
  onAddToCart,
  accentColor,
  placement,
}: {
  title: string;
  subtitle: string | null;
  products: T[];
  language: "TR" | "EN";
  t: (tr: string | null | undefined, en: string | null | undefined) => string;
  orderingClosed: boolean;
  isProductOutOfStock: (p: T) => boolean;
  onAddToCart: (p: T) => void;
  accentColor: string;
  placement: StorefrontFrequentPlacement;
}) {
  if (products.length === 0) return null;

  const scrollRow = (
    <div
      className={[
        "-mx-1 overflow-x-auto overflow-y-hidden pb-1 [scrollbar-width:thin]",
        placement === "BLOCK" ? "px-0" : "",
        "snap-x snap-mandatory",
      ].join(" ")}
    >
      <div className="flex w-max gap-3 px-1 pb-0.5">
        {products.map((product) => {
          const out = isProductOutOfStock(product);
          const displayName = t(product.nameTR, product.nameEN);
          return (
            <ShowcaseCard
              key={product.id}
              product={product}
              displayName={displayName}
              orderingClosed={orderingClosed}
              outOfStock={out}
              onAdd={() => onAddToCart(product)}
              accentVar={accentColor}
            />
          );
        })}
      </div>
    </div>
  );

  const inner = (
    <>
      <div className="mb-2.5 px-0.5">
        <h2 className="text-[0.9375rem] font-semibold tracking-tight text-[#1a1814]">
          {t(title, title)}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-[12.5px] leading-snug text-[#7a6a58]">{t(subtitle, subtitle)}</p>
        ) : null}
      </div>
      {scrollRow}
    </>
  );

  const shell =
    placement === "BLOCK" ? (
      <div className="rounded-2xl border border-[#e8dfd2] bg-[#fffaf6] px-3 py-3 shadow-[0_1px_3px_rgba(23,20,16,0.05)] sm:px-3.5">
        {inner}
      </div>
    ) : placement === "ABOVE_CATEGORIES" ? (
      <div className="pt-0.5">{inner}</div>
    ) : (
      inner
    );

  return (
    <section
      className="w-full"
      aria-label={language === "TR" ? title : t(title, title)}
    >
      {shell}
    </section>
  );
}

export function StorefrontPopularShowcaseSection<T extends ShowcaseProductMinimal>({
  title,
  subtitle,
  products,
  language,
  t,
  orderingClosed,
  isProductOutOfStock,
  onAddToCart,
  accentColor,
  autoplayEnabled,
  autoplaySpeed,
}: {
  title: string;
  subtitle: string | null;
  products: T[];
  language: "TR" | "EN";
  t: (tr: string | null | undefined, en: string | null | undefined) => string;
  orderingClosed: boolean;
  isProductOutOfStock: (p: T) => boolean;
  onAddToCart: (p: T) => void;
  accentColor: string;
  autoplayEnabled: boolean;
  autoplaySpeed: StorefrontAutoplaySpeed;
}) {
  const reducedMotion = usePrefersReducedMotion();
  if (products.length === 0) return null;

  const cards = products.map((product) => {
    const out = isProductOutOfStock(product);
    const displayName = t(product.nameTR, product.nameEN);
    return (
      <ShowcaseCard
        key={product.id}
        product={product}
        displayName={displayName}
        orderingClosed={orderingClosed}
        outOfStock={out}
        onAdd={() => onAddToCart(product)}
        accentVar={accentColor}
      />
    );
  });

  const shouldAutoplay = autoplayEnabled && !reducedMotion;
  const durationSec = autoplaySpeed === "NORMAL" ? 58 : 92;

  return (
    <section
      className="w-full"
      aria-label={language === "TR" ? title : t(title, title)}
    >
      <div className="mb-2.5 px-0.5">
        <h2 className="text-[0.9375rem] font-semibold tracking-tight text-[#1a1814]">
          {t(title, title)}
        </h2>
        {subtitle ? (
          <p className="mt-0.5 text-[12.5px] leading-snug text-[#7a6a58]">{t(subtitle, subtitle)}</p>
        ) : null}
      </div>

      {shouldAutoplay ? (
        <div className="storefront-showcase-fade-edge -mx-1 overflow-hidden pb-1">
          <div
            className="storefront-showcase-marquee-inner"
            style={{ animationDuration: `${durationSec}s` }}
          >
            {cards}
            {cards}
          </div>
        </div>
      ) : (
        <div className="-mx-1 overflow-x-auto overflow-y-hidden pb-1 [scrollbar-width:thin] snap-x snap-mandatory">
          <div className="flex w-max gap-3 px-1 pb-0.5">{cards}</div>
        </div>
      )}
    </section>
  );
}
