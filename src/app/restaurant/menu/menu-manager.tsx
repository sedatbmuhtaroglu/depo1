"use client";

import React, { useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/app/actions/category-crud";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  bulkUpdatePrices,
} from "@/app/actions/product-crud";
import { uploadProductImage } from "@/app/actions/upload-product-image";
import {
  createOptionGroup,
  deleteOptionGroup,
  createOption,
  updateOption,
  deleteOption,
} from "@/app/actions/product-options";
import { activateMenu, createMenu } from "@/app/actions/menu-management";
import {
  badgeClasses,
  buttonClasses,
  cardClasses,
  fieldClasses,
  helperTextClasses,
  labelClasses,
} from "@/lib/ui/button-variants";
import { PanelSelect } from "@/components/ui/panel-select";

type Restaurant = { id: number; name: string };
type Menu = {
  id: number;
  name: string;
  isActive: boolean;
  restaurantId: number | null;
};
type Product = {
  id: number;
  categoryId: number;
  nameTR: string;
  nameEN: string | null;
  descriptionTR: string | null;
  descriptionEN: string | null;
  price: string;
  imageUrl: string | null;
  isAvailable: boolean;
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  trackStock: boolean;
  stockQuantity: number;
  visibleFrom: string | null;
  visibleUntil: string | null;
  tags: string[] | null;
  options: unknown;
  optionGroups?: {
    id: number;
    nameTR: string;
    nameEN: string | null;
    minSelect: number;
    maxSelect: number | null;
    isRequired: boolean;
    options: {
      id: number;
      nameTR: string;
      nameEN: string | null;
      priceDelta: string | null;
      isActive: boolean;
    }[];
  }[];
};
type Category = {
  id: number;
  nameTR: string;
  nameEN: string | null;
  restaurantId: number;
  menuId: number | null;
  products: Product[];
};

const PANEL_CARD_CLASS = cardClasses({ className: "p-4 sm:p-5" });
const INPUT_CLASS = fieldClasses({ size: "md" });
const INPUT_COMPACT_CLASS = fieldClasses({ size: "sm" });

function isoToDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const min = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export default function MenuManager({
  restaurants,
  menus,
  selectedMenuId,
  categories,
}: {
  restaurants: Restaurant[];
  menus: Menu[];
  selectedMenuId: number | null;
  categories: Category[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [newMenuName, setNewMenuName] = useState("");
  const [newMenuRestaurantId, setNewMenuRestaurantId] = useState<string>("all");
  const [catNameTR, setCatNameTR] = useState("");
  const [catRestaurantId, setCatRestaurantId] = useState(() => {
    const selectedMenu = menus.find((m) => m.id === selectedMenuId);
    if (selectedMenu?.restaurantId) return selectedMenu.restaurantId;
    return restaurants[0]?.id ?? 0;
  });
  const [bulkCategoryId, setBulkCategoryId] = useState<number | "all">("all");
  const [bulkType, setBulkType] = useState<"percent" | "fixed">("percent");
  const [bulkValue, setBulkValue] = useState("");

  const handleSwitchMenu = (menuId: number | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (menuId === null) {
      params.delete("menuId");
    } else {
      params.set("menuId", String(menuId));
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleCreateMenu = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMenuName.trim()) {
      toast.error("Menü adı girin.");
      return;
    }
    startTransition(async () => {
      const result = await createMenu({
        name: newMenuName,
        restaurantId:
          newMenuRestaurantId === "all" ? null : Number(newMenuRestaurantId),
      });
      if (result.success) {
        toast.success("Menü oluşturuldu.");
        setNewMenuName("");
        setNewMenuRestaurantId("all");
        router.refresh();
      } else {
        toast.error(result.message ?? "Menü oluşturulamadı.");
      }
    });
  };

  const handleActivateMenu = (menuId: number) => {
    startTransition(async () => {
      const result = await activateMenu(menuId);
      if (result.success) {
        toast.success("Menü aktif edildi.");
        handleSwitchMenu(menuId);
      } else {
        toast.error(result.message ?? "Menü aktifleştirilemedi.");
      }
    });
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catNameTR.trim()) {
      toast.error("Kategori adı girin.");
      return;
    }
    startTransition(async () => {
      const r = await createCategory(
        catRestaurantId,
        catNameTR,
        undefined,
        selectedMenuId ?? undefined,
      );
      if (r.success) {
        toast.success("Kategori eklendi.");
        setCatNameTR("");
        router.refresh();
      } else toast.error(r.message ?? "Bir hata oluştu");
    });
  };

  const handleBulkPrice = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(bulkValue);
    if (Number.isNaN(val)) {
      toast.error("Geçerli bir değer girin.");
      return;
    }
    startTransition(async () => {
      const r = await bulkUpdatePrices({
        categoryId: bulkCategoryId === "all" ? undefined : bulkCategoryId,
        restaurantId:
          bulkCategoryId === "all" ? restaurants[0]?.id : undefined,
        type: bulkType,
        value: val,
      });
      if (r.success) {
        toast.success(`${r.count} ürün güncellendi.`);
        setBulkValue("");
        router.refresh();
      } else toast.error(r.message ?? "Bir hata oluştu");
    });
  };

  return (
    <div className="space-y-4">
      <section className={PANEL_CARD_CLASS}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#111827]">Menüler</h3>
            <p className="mt-1 text-xs text-[#6B7280]">
              Aktif menüyü seçin, yeni menü oluşturun ve restoran kapsamını belirleyin.
            </p>
          </div>
          <span className={badgeClasses("neutral")}>{menus.length} menü</span>
        </div>

        <div className={cardClasses({ tone: "subtle", className: "mb-4 px-3.5 py-2.5" })}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-[#4B5563]">
              Stok takibi yalnızca <span className="font-semibold text-[#111827]">Stoklar</span>{" "}
              ekranından yönetilir.
            </p>
            <span className={badgeClasses("info")}>Operasyon Notu</span>
          </div>
        </div>

        {menus.length === 0 ? (
          <div className={cardClasses({ tone: "subtle", className: "mb-4 px-4 py-6 text-center" })}>
            <p className="text-sm font-medium text-[#111827]">Henüz menü oluşturulmamış</p>
            <p className="mt-1 text-xs text-[#6B7280]">
              İlk menüyü aşağıdaki formdan oluşturabilirsiniz.
            </p>
          </div>
        ) : (
          <div className="mb-4 grid gap-2.5 lg:grid-cols-2">
            {menus.map((menu) => (
              <div
                key={menu.id}
                className={cardClasses({
                  tone: menu.id === selectedMenuId ? "success" : "default",
                  className: "px-4 py-3.5",
                })}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#111827]">{menu.name}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span
                        className={badgeClasses(menu.isActive ? "success" : "neutral")}
                      >
                        {menu.isActive ? "Aktif Menü" : "Pasif Menü"}
                      </span>
                      {menu.id === selectedMenuId && (
                        <span className={badgeClasses("info")}>Açık düzenleme</span>
                      )}
                    </div>
                  </div>
                    <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-[#E5E7EB] bg-[#FFFFFF] p-1">
                      <button
                        type="button"
                        onClick={() => handleSwitchMenu(menu.id)}
                        className={buttonClasses({
                          variant: "outline",
                          size: "xs",
                          className: "px-2.5",
                        })}
                      >
                        Menüyü Aç
                      </button>
                      <button
                        type="button"
                        onClick={() => handleActivateMenu(menu.id)}
                        disabled={isPending || menu.isActive}
                        className={buttonClasses({
                          variant: "primary",
                          size: "xs",
                          className: "px-2.5",
                        })}
                      >
                        Aktif Et
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className={cardClasses({ tone: "subtle", className: "p-3 sm:p-3.5 shadow-none" })}>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.1em] text-[#6B7280]">
            Yeni Menü Oluştur
          </p>
          <form
            onSubmit={handleCreateMenu}
            className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(190px,230px)_auto]"
          >
            <input
              type="text"
              value={newMenuName}
              onChange={(e) => setNewMenuName(e.target.value)}
              placeholder="Yeni menü adı"
              className={INPUT_CLASS}
            />
            <PanelSelect
              value={newMenuRestaurantId}
              onValueChange={setNewMenuRestaurantId}
              aria-label="Menü restoran kapsamı"
              options={[
                { value: "all", label: "Tüm restoranlar" },
                ...restaurants.map((restaurant) => ({
                  value: restaurant.id,
                  label: restaurant.name,
                })),
              ]}
            />
            <button
              type="submit"
              disabled={isPending}
              className={buttonClasses({
                variant: "primary",
                size: "md",
                className: "h-[2.375rem] w-full px-4 sm:w-auto",
              })}
            >
              Menü Oluştur
            </button>
          </form>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <section className={PANEL_CARD_CLASS}>
          <h3 className="text-sm font-semibold text-[#111827]">Kategori Ekle</h3>
          <p className="mt-1 text-xs text-[#6B7280]">
            Seçilen restoran için yeni kategori oluşturun.
          </p>
          <form
            onSubmit={handleAddCategory}
            className="mt-3 grid gap-2.5 sm:grid-cols-[minmax(180px,220px)_minmax(0,1fr)_auto]"
          >
            <PanelSelect
              value={String(catRestaurantId)}
              onValueChange={(nextValue) => setCatRestaurantId(Number(nextValue))}
              aria-label="Kategori restoran seçimi"
              options={restaurants.map((restaurant) => ({
                value: restaurant.id,
                label: restaurant.name,
              }))}
            />
            <input
              type="text"
              value={catNameTR}
              onChange={(e) => setCatNameTR(e.target.value)}
              placeholder="Kategori adı"
              className={INPUT_CLASS}
            />
            <button
              type="submit"
              disabled={isPending}
              className={buttonClasses({
                variant: "primary",
                size: "md",
                className: "h-[2.375rem] w-full px-4 sm:w-auto",
              })}
            >
              Ekle
            </button>
          </form>
        </section>

        <section className={PANEL_CARD_CLASS}>
          <h3 className="text-sm font-semibold text-[#111827]">Toplu Fiyat Güncelleme</h3>
          <p className="mt-1 text-xs text-[#6B7280]">
            Kategori bazlı veya tüm kategoriler için fiyatları tek işlemde güncelleyin.
          </p>
          <form
            onSubmit={handleBulkPrice}
            className="mt-3 grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(140px,180px)_120px_auto]"
          >
            <PanelSelect
              value={bulkCategoryId === "all" ? "all" : String(bulkCategoryId)}
              onValueChange={(nextValue) =>
                setBulkCategoryId(nextValue === "all" ? "all" : Number(nextValue))
              }
              aria-label="Toplu fiyat kategori seçimi"
              options={[
                { value: "all", label: "Tüm kategoriler" },
                ...categories.map((category) => ({
                  value: category.id,
                  label: category.nameTR,
                })),
              ]}
            />
            <PanelSelect
              value={bulkType}
              onValueChange={(nextValue) => setBulkType(nextValue as "percent" | "fixed")}
              aria-label="Toplu fiyat işlem tipi"
              options={[
                { value: "percent", label: "Yüzde (%)" },
                { value: "fixed", label: "Sabit tutar (+)" },
              ]}
            />
            <input
              type="number"
              step="0.01"
              value={bulkValue}
              onChange={(e) => setBulkValue(e.target.value)}
              placeholder={bulkType === "percent" ? "10" : "5.00"}
              className={INPUT_CLASS}
            />
            <button
              type="submit"
              disabled={isPending}
              className={buttonClasses({
                variant: "warning",
                size: "md",
                className: "h-[2.375rem] w-full px-4 sm:w-auto",
              })}
            >
              Uygula
            </button>
          </form>
        </section>
      </div>

      <section className={cardClasses({ className: "p-4 sm:p-5" })}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-[#111827]">Kategori ve Ürün Listesi</h3>
            <p className="mt-1 text-xs text-[#6B7280]">
              Ürünleri kategori bazında düzenleyin, seçenek gruplarını yönetin.
            </p>
          </div>
          <span className={badgeClasses("neutral")}>
            {categories.length} kategori •{" "}
            {categories.reduce((sum, category) => sum + category.products.length, 0)} ürün
          </span>
        </div>

        {categories.length === 0 ? (
          <div className={cardClasses({ tone: "subtle", className: "px-4 py-8 text-center" })}>
            <p className="text-sm font-medium text-[#111827]">Kategori bulunamadı</p>
            <p className="mt-1 text-xs text-[#6B7280]">
              Önce kategori oluşturup ardından ürün ekleyebilirsiniz.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {categories.map((cat) => (
              <CategoryBlock
                key={cat.id}
                category={cat}
                onRefresh={() => router.refresh()}
                isPending={isPending}
                startTransition={startTransition}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function CategoryBlock({
  category,
  onRefresh,
  isPending,
  startTransition,
}: {
  category: Category;
  onRefresh: () => void;
  isPending: boolean;
  startTransition: (fn: () => Promise<void>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [nameTR, setNameTR] = useState(category.nameTR);
  const [addProductOpen, setAddProductOpen] = useState(false);

  const handleUpdateCategory = () => {
    startTransition(async () => {
      const r = await updateCategory(category.id, nameTR);
      if (r.success) {
        toast.success("Kategori güncellendi.");
        setEditing(false);
        onRefresh();
      } else toast.error(r.message ?? "Bir hata oluştu");
    });
  };

  const handleDeleteCategory = () => {
    if (!confirm("Bu kategoriyi silmek istediğinize emin misiniz?")) return;
    startTransition(async () => {
      const r = await deleteCategory(category.id);
      if (r.success) {
        toast.success("Kategori silindi.");
        onRefresh();
      } else toast.error(r.message ?? "Bir hata oluştu");
    });
  };

  return (
    <section className={cardClasses({ tone: "subtle", className: "p-3.5 sm:p-4" })}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2.5">
        {editing ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={nameTR}
              onChange={(e) => setNameTR(e.target.value)}
              className={fieldClasses({ size: "sm", className: "min-w-[180px]" })}
            />
            <button
              type="button"
              onClick={handleUpdateCategory}
              disabled={isPending}
              className={buttonClasses({
                variant: "success",
                size: "xs",
                className: "px-2.5",
              })}
            >
              Kaydet
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className={buttonClasses({
                variant: "secondary",
                size: "xs",
                className: "px-2.5",
              })}
            >
              İptal
            </button>
          </div>
        ) : (
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="truncate text-sm font-semibold text-[#111827]">{category.nameTR}</h3>
              <span className={badgeClasses("neutral")}>{category.products.length} ürün</span>
            </div>
            <p className="mt-1 text-xs text-[#6B7280]">
              Kategori içindeki ürünleri ve seçenek gruplarını buradan yönetin.
            </p>
          </div>
        )}
        {!editing && (
          <div className="inline-flex flex-wrap gap-1">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className={buttonClasses({
                variant: "outline",
                size: "xs",
                className: "px-2.5 font-medium",
              })}
            >
              Düzenle
            </button>
            <button
              type="button"
              onClick={handleDeleteCategory}
              disabled={isPending || category.products.length > 0}
              className={buttonClasses({
                variant: "outline",
                size: "xs",
                className: "px-2.5 font-medium text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200",
              })}
            >
              Sil
            </button>
            <button
              type="button"
              onClick={() => setAddProductOpen((v) => !v)}
              className={buttonClasses({
                variant: "primary",
                size: "xs",
                className: "px-2.5",
              })}
            >
              + Ürün
            </button>
          </div>
        )}
      </div>

      {addProductOpen && (
        <ProductForm
          categoryId={category.id}
          onSuccess={() => {
            setAddProductOpen(false);
            onRefresh();
          }}
          onCancel={() => setAddProductOpen(false)}
          isPending={isPending}
          startTransition={startTransition}
          />
        )}

      {category.products.length === 0 ? (
        <div className={cardClasses({ className: "px-4 py-6 text-center" })}>
          <p className="text-sm font-medium text-[#111827]">Bu kategoride ürün yok</p>
          <p className="mt-1 text-xs text-[#6B7280]">
            Ürün ekleyerek operasyon listesini doldurabilirsiniz.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {category.products.map((p) => (
            <ProductRow
              key={p.id}
              product={p}
              onRefresh={onRefresh}
              isPending={isPending}
              startTransition={startTransition}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ProductForm({
  categoryId,
  onSuccess,
  onCancel,
  isPending,
  startTransition,
}: {
  categoryId: number;
  onSuccess: () => void;
  onCancel: () => void;
  isPending: boolean;
  startTransition: (fn: () => Promise<void>) => void;
}) {
  const [nameTR, setNameTR] = useState("");
  const [price, setPrice] = useState("");
  const [descriptionTR, setDescriptionTR] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isAvailable, setIsAvailable] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [sortOrder, setSortOrder] = useState("0");
  const [visibleUntil, setVisibleUntil] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [isUploading, startUploading] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    startUploading(async () => {
      const formData = new FormData();
      formData.append("file", file);
      const result = await uploadProductImage(formData);
      if (result.success && result.url) {
        setImageUrl(result.url);
        toast.success("Görsel yüklendi.");
      } else {
        toast.error(
          (result as { message?: string }).message ??
            "Görsel yüklenemedi. Lütfen tekrar deneyin.",
        );
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseFloat(price);
    if (!nameTR.trim() || Number.isNaN(p) || p < 0) {
      toast.error("Ad ve geçerli fiyat girin.");
      return;
    }
    startTransition(async () => {
      const parsedSortOrder = Number(sortOrder);
      const r = await createProduct({
        categoryId,
        nameTR: nameTR.trim(),
        descriptionTR: descriptionTR.trim() || undefined,
        price: p,
        imageUrl: imageUrl.trim() || undefined,
        isAvailable,
        isActive,
        isFeatured,
        sortOrder: Number.isFinite(parsedSortOrder) ? parsedSortOrder : 0,
        visibleUntil: visibleUntil ? visibleUntil : null,
        tags: tagsStr.trim() ? tagsStr.split(",").map((s) => s.trim()) : undefined,
      });
      if (r.success) {
        toast.success("Ürün eklendi.");
        onSuccess();
      } else toast.error(r.message ?? "Bir hata oluştu");
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={cardClasses({ tone: "subtle", className: "mb-4 p-3" })}
    >
      <div className="grid gap-2.5 sm:grid-cols-2">
        <input
          value={nameTR}
          onChange={(e) => setNameTR(e.target.value)}
          placeholder="Ürün adı"
          className={INPUT_COMPACT_CLASS}
          required
        />
        <input
          type="number"
          step="0.01"
          min="0"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Fiyat"
          className={INPUT_COMPACT_CLASS}
          required
        />
        <input
          value={descriptionTR}
          onChange={(e) => setDescriptionTR(e.target.value)}
          placeholder="Açıklama"
          className={fieldClasses({ size: "sm", className: "sm:col-span-2" })}
        />
        <div className="flex items-center gap-3 sm:col-span-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className={buttonClasses({
              variant: "outline",
              size: "sm",
              className: "px-3",
            })}
          >
            {isUploading ? "Yükleniyor..." : "Görsel Yükle"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageFileChange}
          />
          {imageUrl && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B7280]">
              <img
                src={imageUrl}
                alt="Önizleme"
                className="h-10 w-10 rounded-md object-cover border border-neutral-200"
              />
              <button
                type="button"
                onClick={() => setImageUrl("")}
                className={buttonClasses({
                  variant: "ghost",
                  size: "xs",
                  className: "px-2",
                })}
              >
                Görseli Kaldır
              </button>
            </div>
          )}
        </div>
        <input
          value={tagsStr}
          onChange={(e) => setTagsStr(e.target.value)}
          placeholder="Etiketler (virgülle: yemek, sıcak)"
          className={INPUT_COMPACT_CLASS}
        />
        <label className={labelClasses("inline-flex items-center gap-2 text-sm")}>
          <input
            type="checkbox"
            checked={isAvailable}
            onChange={(e) => setIsAvailable(e.target.checked)}
            className="h-4 w-4 accent-[#14213D]"
          />
          Stokta var
        </label>

        <label className={labelClasses("inline-flex items-center gap-2 text-sm")}>
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 accent-[#14213D]"
          />
          Menüde görünür
        </label>

        <label className={labelClasses("inline-flex items-center gap-2 text-sm")}>
          <input
            type="checkbox"
            checked={isFeatured}
            onChange={(e) => setIsFeatured(e.target.checked)}
            className="h-4 w-4 accent-[#14213D]"
          />
          Öne çıkar
        </label>

        <input
          type="number"
          min="0"
          step="1"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
          placeholder="Sıralama"
          className={INPUT_COMPACT_CLASS}
        />

        <input
          type="datetime-local"
          value={visibleUntil}
          onChange={(e) => setVisibleUntil(e.target.value)}
          className={fieldClasses({ size: "sm", className: "sm:col-span-2" })}
          aria-label="Gorunurluk bitis tarihi"
        />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={isPending}
          className={buttonClasses({
            variant: "primary",
            size: "sm",
            className: "px-3",
          })}
        >
          Ekle
        </button>
        <button
          type="button"
          onClick={onCancel}
          className={buttonClasses({
            variant: "secondary",
            size: "sm",
            className: "px-3",
          })}
        >
          İptal
        </button>
      </div>
    </form>
  );
}

function ProductRow({
  product,
  onRefresh,
  isPending,
  startTransition,
}: {
  product: Product;
  onRefresh: () => void;
  isPending: boolean;
  startTransition: (fn: () => Promise<void>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [nameTR, setNameTR] = useState(product.nameTR);
  const [price, setPrice] = useState(product.price);
  const [descriptionTR, setDescriptionTR] = useState(product.descriptionTR ?? "");
  const [isAvailable, setIsAvailable] = useState(product.isAvailable);
  const [isActive, setIsActive] = useState(product.isActive);
  const [isFeatured, setIsFeatured] = useState(product.isFeatured);
  const [sortOrder, setSortOrder] = useState(String(product.sortOrder));
  const [visibleUntil, setVisibleUntil] = useState(
    isoToDatetimeLocalValue(product.visibleUntil),
  );
  const [imageUrl, setImageUrl] = useState(product.imageUrl ?? "");
  const [isUploading, startUploading] = useTransition();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    startUploading(async () => {
      const formData = new FormData();
      formData.append("file", file);
      const result = await uploadProductImage(formData);
      if (result.success && result.url) {
        setImageUrl(result.url);
        toast.success("Görsel yüklendi.");
      } else {
        toast.error(
          (result as { message?: string }).message ??
            "Görsel yüklenemedi. Lütfen tekrar deneyin.",
        );
      }
    });
  };

  const handleUpdate = () => {
    const p = parseFloat(price);
    if (Number.isNaN(p) || p < 0) {
      toast.error("Geçerli fiyat girin.");
      return;
    }
    startTransition(async () => {
      const r = await updateProduct(product.id, {
        nameTR: nameTR.trim(),
        descriptionTR: descriptionTR.trim() || undefined,
        price: p,
        imageUrl: imageUrl.trim() || null,
        isAvailable,
        isActive,
        isFeatured,
        sortOrder: Number(sortOrder),
        visibleUntil: visibleUntil ? visibleUntil : null,
      });
      if (r.success) {
        toast.success("Ürün güncellendi.");
        setEditing(false);
        onRefresh();
      } else toast.error(r.message ?? "Bir hata oluştu");
    });
  };

  const handleDelete = () => {
    if (!confirm("Bu ürünü silmek istediğinize emin misiniz?")) return;
    startTransition(async () => {
      const r = await deleteProduct(product.id);
      if (r.success) {
        toast.success("Ürün silindi.");
        onRefresh();
      } else toast.error(r.message ?? "Bir hata oluştu");
    });
  };

  const optionGroupCount = product.optionGroups?.length ?? 0;

  return (
    <article className={cardClasses({ className: "space-y-3 px-3.5 py-3.5 text-sm" })}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {editing ? (
          <div className="w-full space-y-3">
            <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-[minmax(180px,1fr)_110px_minmax(260px,1.2fr)_auto]">
              <input
                value={nameTR}
                onChange={(e) => setNameTR(e.target.value)}
                className={fieldClasses({ size: "sm" })}
              />
              <input
                type="number"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={fieldClasses({ size: "sm" })}
              />
              <input
                value={descriptionTR}
                onChange={(e) => setDescriptionTR(e.target.value)}
                placeholder="Açıklama"
                className={fieldClasses({ size: "sm" })}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className={buttonClasses({
                  variant: "outline",
                  size: "sm",
                  className: "w-full px-3",
                })}
              >
                {isUploading ? "Yükleniyor..." : "Görsel Yükle"}
              </button>
              <input
                type="number"
                min="0"
                step="1"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                placeholder="Sıralama"
                className={fieldClasses({ size: "sm" })}
              />

              <input
                type="datetime-local"
                value={visibleUntil}
                onChange={(e) => setVisibleUntil(e.target.value)}
                className={fieldClasses({ size: "sm", className: "sm:col-span-2" })}
                aria-label="Gorunurluk bitis tarihi"
              />
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageFileChange}
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {imageUrl && (
                  <div className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-2 py-1">
                    <img
                      src={imageUrl}
                      alt="Ürün görseli"
                      className="h-8 w-8 rounded object-cover border border-neutral-200"
                    />
                    <button
                      type="button"
                      onClick={() => setImageUrl("")}
                      className={buttonClasses({
                        variant: "ghost",
                        size: "xs",
                        className: "px-2",
                      })}
                    >
                      Görseli Kaldır
                    </button>
                  </div>
                )}
                <label className={labelClasses("inline-flex items-center gap-1.5 text-xs")}>
                  <input
                    type="checkbox"
                    checked={isAvailable}
                    onChange={(e) => setIsAvailable(e.target.checked)}
                    className="h-4 w-4 accent-[#14213D]"
                  />
                  Stokta
                </label>

                <label className={labelClasses("inline-flex items-center gap-1.5 text-xs")}>
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 accent-[#14213D]"
                  />
                  Menüde görünür
                </label>

                <label className={labelClasses("inline-flex items-center gap-1.5 text-xs")}>
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="h-4 w-4 accent-[#14213D]"
                  />
                  Öne çıkar
                </label>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={handleUpdate}
                  disabled={isPending}
                  className={buttonClasses({
                    variant: "success",
                    size: "xs",
                    className: "px-2.5",
                  })}
                >
                  Kaydet
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className={buttonClasses({
                    variant: "secondary",
                    size: "xs",
                    className: "px-2.5",
                  })}
                >
                  İptal
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={badgeClasses(product.isAvailable ? "success" : "neutral")}
                >
                  {product.isAvailable ? "Aktif" : "Pasif"}
                </span>
                <span
                  className={badgeClasses(product.isActive ? "success" : "neutral")}
                >
                  {product.isActive ? "Menüde görünür" : "Menüde gizli"}
                </span>
                {product.isFeatured ? (
                  <span className={badgeClasses("info")}>Öne çıkan</span>
                ) : null}
                <span className={badgeClasses("info")}>
                  {optionGroupCount} seçenek grubu
                </span>
                {product.trackStock && (
                  <span
                    className={`${badgeClasses("neutral")} ${
                      product.stockQuantity > 0
                        ? "border-[#D8E8E3] bg-[#EAF4F1] text-[#167C63]"
                        : "border-[#F2CCCC] bg-[#FAE8E8] text-[#C24141]"
                    }`}
                  >
                    Stok: {product.stockQuantity}
                  </span>
                )}
              </div>

              <p
                className={`text-sm font-semibold ${
                  product.isAvailable ? "text-[#111827]" : "text-[#9CA3AF] line-through"
                }`}
              >
                {product.nameTR}
              </p>

              {product.descriptionTR && (
                <p className="max-w-[720px] text-xs text-[#6B7280]">{product.descriptionTR}</p>
              )}

              {product.tags && product.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {product.tags.map((tag) => (
                    <span key={`${product.id}-${tag}`} className={badgeClasses("neutral")}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex w-full flex-col items-start gap-2.5 lg:w-auto lg:min-w-[210px] lg:items-end">
              <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-3 py-2">
                <p className="text-[10px] uppercase tracking-[0.11em] text-[#6B7280]">Fiyat</p>
                <p className="mt-0.5 text-base font-semibold text-[#111827]">
                  {new Intl.NumberFormat("tr-TR", {
                    style: "currency",
                    currency: "TRY",
                    minimumFractionDigits: 2,
                  }).format(Number(product.price))}
                </p>
              </div>
              <div className="inline-flex flex-wrap gap-1 rounded-lg border border-[#E5E7EB] bg-[#FFFFFF] p-1">
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className={buttonClasses({
                    variant: "outline",
                    size: "xs",
                    className: "px-2.5",
                  })}
                >
                  Düzenle
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isPending}
                  className={buttonClasses({
                    variant: "danger",
                    size: "xs",
                    className: "px-2.5",
                  })}
                >
                  Sil
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      <ProductOptionsSection
        product={product}
        isPending={isPending}
        startTransition={startTransition}
        onChanged={onRefresh}
      />
    </article>
  );
}

function ProductOptionsSection({
  product,
  isPending,
  startTransition,
  onChanged,
}: {
  product: Product;
  isPending: boolean;
  startTransition: (fn: () => Promise<void>) => void;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupMin, setNewGroupMin] = useState("0");
  const [newGroupMax, setNewGroupMax] = useState<string>("");

  const groups = product.optionGroups ?? [];

  const handleAddGroup = () => {
    const min = Number(newGroupMin || "0");
    const max = newGroupMax === "" ? null : Number(newGroupMax);
    if (!newGroupName.trim()) {
      toast.error("Grup adı girin.");
      return;
    }
    if (Number.isNaN(min) || min < 0) {
      toast.error("Geçerli bir minimum seçim değeri girin.");
      return;
    }
    if (max !== null && (Number.isNaN(max) || max < min)) {
      toast.error("Maksimum, minimumdan küçük olamaz.");
      return;
    }
    startTransition(async () => {
      const res = await createOptionGroup({
        productId: product.id,
        nameTR: newGroupName,
        minSelect: min,
        maxSelect: max,
      });
      if (res.success) {
        toast.success("Seçenek grubu eklendi.");
        setNewGroupName("");
        setNewGroupMin("0");
        setNewGroupMax("");
        onChanged();
      } else {
        toast.error(res.message ?? "Seçenek grubu eklenemedi.");
      }
    });
  };

  const handleDeleteGroup = (groupId: number) => {
    if (!confirm("Bu seçenek grubunu silmek istediğinize emin misiniz?")) return;
    startTransition(async () => {
      const res = await deleteOptionGroup(groupId);
      if (res.success) {
        toast.success("Seçenek grubu silindi.");
        onChanged();
      } else {
        toast.error(res.message ?? "Seçenek grubu silinemedi.");
      }
    });
  };

  const handleAddOption = (groupId: number, name: string, priceDeltaRaw: string) => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Seçenek adı girin.");
      return;
    }
    const delta =
      priceDeltaRaw.trim() === "" ? null : Number(priceDeltaRaw.trim());
    if (delta !== null && Number.isNaN(delta)) {
      toast.error("Geçerli bir fiyat farkı girin.");
      return;
    }
    startTransition(async () => {
      const res = await createOption({
        groupId,
        nameTR: trimmed,
        priceDelta: delta,
      });
      if (res.success) {
        toast.success("Seçenek eklendi.");
        onChanged();
      } else {
        toast.error(res.message ?? "Seçenek eklenemedi.");
      }
    });
  };

  const handleToggleOptionActive = (optionId: number, isActive: boolean) => {
    startTransition(async () => {
      const res = await updateOption(optionId, { isActive: !isActive });
      if (res.success) {
        onChanged();
      } else {
        toast.error(res.message ?? "Seçenek güncellenemedi.");
      }
    });
  };

  const handleDeleteOption = (optionId: number) => {
    if (!confirm("Bu seçeneği silmek istediğinize emin misiniz?")) return;
    startTransition(async () => {
      const res = await deleteOption(optionId);
      if (res.success) {
        toast.success("Seçenek silindi.");
        onChanged();
      } else {
        toast.error(res.message ?? "Seçenek silinemedi.");
      }
    });
  };

  return (
    <div className={cardClasses({ tone: "subtle", className: "px-3 py-2.5" })}>
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-lg border border-[#E5E7EB] bg-[#FFFFFF] px-3 py-2 text-xs font-semibold text-[#111827]"
        onClick={() => setOpen((v) => !v)}
      >
        <span>Seçenek Grupları</span>
        <span className="inline-flex items-center gap-1 text-[11px] text-[#6B7280]">
          <span className={badgeClasses("neutral")}>{groups.length}</span>
          {open ? "Gizle" : "Göster"}
        </span>
      </button>
      {open && (
        <div className="mt-2.5 space-y-2">
          {groups.length === 0 && (
            <p className={helperTextClasses()}>
              Bu ürün için henüz seçenek grubu yok.
            </p>
          )}
          {groups.map((g) => (
            <div key={g.id} className={cardClasses({ className: "space-y-2 p-2.5" })}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-[#111827]">{g.nameTR}</div>
                  <div className="text-[11px] text-[#6B7280]">
                    Min: {g.minSelect} / Max:{" "}
                    {g.maxSelect === null ? "Sınırsız" : g.maxSelect}{" "}
                      {g.isRequired && "(zorunlu)"}{" "}
                      {g.isRequired && g.minSelect === 1 && g.maxSelect === 1
                        ? "(varyant)"
                        : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteGroup(g.id)}
                  disabled={isPending}
                  className={buttonClasses({
                    variant: "danger",
                    size: "xs",
                    className: "px-2.5",
                  })}
                >
                  Grubu Sil
                </button>
              </div>
              <div className="space-y-1.5">
                {g.options.map((o) => (
                  <div
                    key={o.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#ECEFF3] bg-[#FFFFFF] px-2 py-1.5 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={
                          o.isActive
                            ? "text-[#111827]"
                            : "text-[#9CA3AF] line-through"
                        }
                      >
                        {o.nameTR}
                      </span>
                      {o.priceDelta && (
                        <span className="text-[11px] text-[#6B7280]">
                          (+{Number(o.priceDelta).toFixed(2)} TL)
                        </span>
                      )}
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-md border border-[#E5E7EB] bg-[#F9FAFB] p-1">
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleOptionActive(o.id, o.isActive)
                        }
                        disabled={isPending}
                        className={buttonClasses({
                          variant: "outline",
                          size: "xs",
                          className: "px-2.5",
                        })}
                      >
                        {o.isActive ? "Pasifleştir" : "Aktifleştir"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteOption(o.id)}
                        disabled={isPending}
                        className={buttonClasses({
                          variant: "danger",
                          size: "xs",
                          className: "px-2.5",
                        })}
                      >
                        Sil
                      </button>
                    </div>
                  </div>
                ))}
                <AddOptionInline
                  groupId={g.id}
                  isPending={isPending}
                  onAdd={handleAddOption}
                />
              </div>
            </div>
          ))}
          <div className={cardClasses({ tone: "subtle", className: "mt-2 space-y-1.5 p-2.5" })}>
            <div className="text-xs font-semibold text-[#111827]">
              Yeni Seçenek Grubu
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Grup adı (örn: Boyut)"
                className={fieldClasses({
                  size: "sm",
                  className: "min-w-[140px] flex-1",
                })}
              />
              <input
                type="number"
                min={0}
                value={newGroupMin}
                onChange={(e) => setNewGroupMin(e.target.value)}
                placeholder="Min"
                className={fieldClasses({ size: "sm", className: "w-[72px]" })}
              />
              <input
                type="number"
                min={0}
                value={newGroupMax}
                onChange={(e) => setNewGroupMax(e.target.value)}
                placeholder="Max"
                className={fieldClasses({ size: "sm", className: "w-[72px]" })}
              />
              <button
                type="button"
                onClick={handleAddGroup}
                disabled={isPending}
                className={buttonClasses({
                  variant: "primary",
                  size: "xs",
                  className: "px-3",
                })}
              >
                Grup Ekle
              </button>
            </div>
            <p className="text-[11px] text-[#6B7280]">
              Max boş bırakılırsa sınırsız kabul edilir. Min &gt; 0 ise grup
              zorunlu olur.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function AddOptionInline({
  groupId,
  isPending,
  onAdd,
}: {
  groupId: number;
  isPending: boolean;
  onAdd: (groupId: number, name: string, priceDelta: string) => void;
}) {
  const [name, setName] = useState("");
  const [priceDelta, setPriceDelta] = useState("");

  const handleSubmit = () => {
    onAdd(groupId, name, priceDelta);
    setName("");
    setPriceDelta("");
  };

  return (
    <div className="mt-1 flex flex-wrap items-center gap-2">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Yeni seçenek (örn: Büyük)"
        className={fieldClasses({
          size: "sm",
          className: "min-w-[120px] flex-1",
        })}
      />
      <input
        type="number"
        step="0.01"
        value={priceDelta}
        onChange={(e) => setPriceDelta(e.target.value)}
        placeholder="+Fiyat"
        className={fieldClasses({ size: "sm", className: "w-[92px]" })}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className={buttonClasses({
          variant: "outline",
          size: "xs",
          className: "px-2.5",
        })}
      >
        Seçenek Ekle
      </button>
    </div>
  );
}

