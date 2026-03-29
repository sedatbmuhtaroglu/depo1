"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { CircleAlert, UtensilsCrossed } from "lucide-react";
import { resolveMenuTheme } from "@/lib/menu-theme";
import {
  PRODUCT_ALLERGEN_LABELS,
  PRODUCT_COMPLIANCE_STATUS_LABELS,
  hasProductComplianceDisplayData,
} from "@/lib/product-compliance";
import type { StorefrontPublicMenuData } from "@/lib/storefront-public-menu-data";

type Product = StorefrontPublicMenuData["categories"][number]["products"][number];

type Props = {
  data: StorefrontPublicMenuData;
};

export default function PublicMenuClient({ data }: Props) {
  const [language, setLanguage] = useState<"TR" | "EN">("TR");
  const [activeCategory, setActiveCategory] = useState(data.categories[0]?.id ?? 0);
  const [complianceModalProduct, setComplianceModalProduct] = useState<Product | null>(null);

  const t = (tr: string | null | undefined, en: string | null | undefined) => {
    const fallback = tr || "";
    return language === "TR" ? fallback : en || fallback;
  };

  const menuTheme = resolveMenuTheme({
    themeColor: data.restaurant.themeColor,
    menuFontSizePx: data.restaurant.menuFontSizePx,
    menuTextColor: data.restaurant.menuTextColor,
    menuBackgroundColor: data.restaurant.menuBackgroundColor,
    menuButtonBackgroundColor: data.restaurant.menuButtonBackgroundColor,
    menuHeaderBackgroundColor: data.restaurant.menuHeaderBackgroundColor,
  });

  const filteredProducts = useMemo(() => {
    const active = data.categories.find((category) => category.id === activeCategory);
    return active ? active.products : [];
  }, [activeCategory, data.categories]);

  const hasComplianceData = (product: Product) =>
    data.restaurant.menuComplianceVisible && hasProductComplianceDisplayData(product.complianceInfo);

  const isProductOutOfStock = (product: Product) =>
    !product.isAvailable || (product.trackStock === true && (product.stockQuantity ?? 0) <= 0);

  const heroSubtitle =
    data.restaurant.openingHour && data.restaurant.closingHour
      ? t(
          `Çalışma saatleri: ${data.restaurant.openingHour} – ${data.restaurant.closingHour}`,
          `Hours: ${data.restaurant.openingHour} – ${data.restaurant.closingHour}`,
        )
      : t("Read-only menü görünümü", "Read-only menu view");

  return (
    <div
      className="storefront-menu min-h-screen pb-20 font-sans text-[#2d251d]"
      style={{ fontSize: `${menuTheme.fontSizePx}px` }}
    >
      <div className="storefront-ref-sticky sticky top-0 z-20">
        <div className="mx-auto w-full max-w-2xl px-3 pt-2 sm:px-4">
          <div className="storefront-shell overflow-hidden rounded-2xl p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8a7a68]">
                  {t("Genel Menü", "Public Menu")}
                </span>
                <span className="text-[#d4c9bc]">·</span>
                <span className="storefront-status-closed inline-flex items-center rounded-full px-2 py-px text-[10px] font-semibold">
                  {t("Salt okunur", "Read-only")}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setLanguage((lang) => (lang === "TR" ? "EN" : "TR"))}
                className="storefront-lang-toggle"
                aria-label={t("Dil değiştir", "Change language")}
              >
                {language === "TR" ? "TR · EN" : "EN · TR"}
              </button>
            </div>
            <h1 className="mt-2 text-xl font-bold leading-snug tracking-tight text-[#1a1814] sm:text-2xl">
              {data.restaurant.name}
            </h1>
            <p className="mt-0.5 text-[13px] leading-snug text-[#7a6a58]">{heroSubtitle}</p>
          </div>
        </div>
        {data.categories.length > 0 ? (
          <nav className="px-3 pb-2 pt-1 sm:px-4" aria-label={t("Kategoriler", "Categories")}>
            <div className="mx-auto w-full max-w-2xl overflow-x-auto [-webkit-overflow-scrolling:touch]">
              <div className="flex min-w-0 gap-1.5 pb-0.5">
                {data.categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setActiveCategory(category.id)}
                    className={`storefront-category-pill ${
                      activeCategory === category.id ? "storefront-category-pill-active" : ""
                    }`}
                  >
                    {t(category.nameTR, category.nameEN)}
                  </button>
                ))}
              </div>
            </div>
          </nav>
        ) : null}
      </div>

      {!data.hasPublishedMenu || data.categories.length === 0 ? (
        <main className="mx-auto flex min-h-[55vh] w-full max-w-2xl items-center px-3 py-10 sm:px-4">
          <div className="storefront-info w-full rounded-2xl p-8 text-center">
            <h2 className="text-lg font-semibold text-[#1a1814]">
              {t("Menü yakında yayında olacak", "Menu will be published soon")}
            </h2>
            <p className="mt-2 text-sm text-[#7a6550]">
              {t(
                "Bu restoran henüz aktif/public menüsünü yayınlamadı.",
                "This restaurant has not published an active public menu yet.",
              )}
            </p>
          </div>
        </main>
      ) : (
        <main className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-3 pb-16 pt-3 sm:px-4">
          {filteredProducts.length === 0 ? (
            <div className="storefront-info rounded-2xl p-6 text-center">
              <p className="text-base font-semibold">
                {t("Bu kategoride ürün yok.", "No items in this category.")}
              </p>
              <p className="mt-1 text-sm text-[#7a6550]">
                {t("Lütfen başka bir kategori seçin.", "Please choose another category.")}
              </p>
            </div>
          ) : null}
          {filteredProducts.map((product) => {
            const outOfStock = isProductOutOfStock(product);
            return (
              <article
                key={product.id}
                className={`storefront-card relative flex min-h-[7rem] overflow-hidden rounded-xl border transition-opacity sm:min-h-[7.25rem] ${
                  outOfStock ? "opacity-65" : ""
                }`}
              >
                <div className="flex min-w-0 flex-1 flex-col justify-between p-3 pr-2.5 sm:p-3.5 sm:pr-3">
                  <div className="min-w-0">
                    {outOfStock ? (
                      <span className="mb-1 inline-flex w-fit rounded-full border border-red-200/90 bg-red-50 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-red-700">
                        {t("Stokta yok", "Out of stock")}
                      </span>
                    ) : null}
                    <h2 className="line-clamp-2 text-[0.9375rem] font-semibold leading-snug text-[#1a1814] sm:text-base">
                      {t(product.nameTR, product.nameEN)}
                    </h2>
                    <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-[#7a6a58]">
                      {t(product.descriptionTR, product.descriptionEN) || "\u00a0"}
                    </p>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-base font-bold tabular-nums tracking-tight text-[#1a1814] sm:text-[1.0625rem]">
                      {product.price.toFixed(2)} TL
                    </p>
                    {hasComplianceData(product) ? (
                      <button
                        type="button"
                        onClick={() => setComplianceModalProduct(product)}
                        className="inline-flex items-center gap-1 rounded-full border border-[#e3d6c6] bg-[#fff8ef] px-2 py-1 text-[11px] font-medium text-[#6f5842]"
                      >
                        <CircleAlert className="h-3.5 w-3.5" aria-hidden />
                        {t("İçerik", "Info")}
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="storefront-product-thumb">
                  {product.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 92px, 100px"
                    />
                  ) : (
                    <div className="flex h-full min-h-[7rem] flex-col items-center justify-center px-1.5 sm:min-h-[7.25rem]">
                      <div className="flex h-11 w-11 items-center justify-center rounded-full border border-[#d9cfc3] bg-[#fffcf7] shadow-sm">
                        <UtensilsCrossed
                          className="h-5 w-5 text-[#c9853f] opacity-90"
                          strokeWidth={2.25}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </main>
      )}

      {complianceModalProduct && hasComplianceData(complianceModalProduct) ? (
        <div className="fixed inset-0 z-[58] flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4">
          <div className="storefront-sheet w-full max-w-lg rounded-t-3xl p-4 sm:rounded-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {t(complianceModalProduct.nameTR, complianceModalProduct.nameEN)}
                </h3>
                <p className="text-xs text-[#7a6651]">
                  {t("İçerik ve ürün bilgileri", "Ingredients and product details")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setComplianceModalProduct(null)}
                className="rounded-md px-2 py-1 text-[#6b5845] hover:bg-[#f7ecdf]"
              >
                X
              </button>
            </div>
            <div className="space-y-2 rounded-xl border border-[#eadfce] bg-[#fff9ef] p-3 text-sm text-[#5f4a35]">
              {complianceModalProduct.complianceInfo?.caloriesKcal != null ? (
                <p>
                  <span className="font-semibold text-[#2d251d]">Kalori:</span>{" "}
                  {complianceModalProduct.complianceInfo.caloriesKcal} kcal
                </p>
              ) : null}
              {complianceModalProduct.complianceInfo?.basicIngredients ? (
                <p>
                  <span className="font-semibold text-[#2d251d]">İçindekiler:</span>{" "}
                  {complianceModalProduct.complianceInfo.basicIngredients}
                </p>
              ) : null}
              {(() => {
                const standardAllergens =
                  complianceModalProduct.complianceInfo?.allergens?.map(
                    (item) => PRODUCT_ALLERGEN_LABELS[item],
                  ) ?? [];
                const customAllergens =
                  complianceModalProduct.complianceInfo?.customAllergens?.filter(Boolean) ?? [];
                const allAllergens = [...standardAllergens, ...customAllergens];
                if (allAllergens.length === 0) return null;
                return (
                  <p>
                    <span className="font-semibold text-[#2d251d]">Alerjenler:</span>{" "}
                    {allAllergens.join(", ")}
                  </p>
                );
              })()}
              {complianceModalProduct.complianceInfo?.alcoholStatus ? (
                <p>
                  <span className="font-semibold text-[#2d251d]">Alkol:</span>{" "}
                  {PRODUCT_COMPLIANCE_STATUS_LABELS[
                    complianceModalProduct.complianceInfo.alcoholStatus
                  ] ?? "Belirtilmedi"}
                </p>
              ) : null}
              {complianceModalProduct.complianceInfo?.porkStatus ? (
                <p>
                  <span className="font-semibold text-[#2d251d]">Domuz içeriği:</span>{" "}
                  {PRODUCT_COMPLIANCE_STATUS_LABELS[
                    complianceModalProduct.complianceInfo.porkStatus
                  ] ?? "Belirtilmedi"}
                </p>
              ) : null}
              {complianceModalProduct.complianceInfo?.crossContaminationNote ? (
                <p>
                  <span className="font-semibold text-[#2d251d]">Uyarı:</span>{" "}
                  {complianceModalProduct.complianceInfo.crossContaminationNote}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
