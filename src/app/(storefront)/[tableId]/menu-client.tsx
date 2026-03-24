"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Plus,
  Minus,
  ClipboardList,
  Coffee,
  QrCode,
  Monitor,
  ChevronRight,
  UtensilsCrossed,
} from "lucide-react";
import { createOrder } from "@/app/actions/create-order";
import { requestBillWithMethod } from "@/app/actions/request-bill-with-method";
import toast, { Toaster } from "react-hot-toast";
import { buildClientRiskSignals } from "@/lib/security/client-risk-signals";
import { playOrderAlertBeep } from "@/lib/order-alert-sound";
import type { CustomerPaymentMethod } from "@/lib/payment-methods";
import {
  MAX_ORDER_RADIUS_METERS,
  MIN_ORDER_RADIUS_METERS,
  calculateDistanceMeters,
} from "@/lib/location";
import { resolveMenuTheme } from "@/lib/menu-theme";
import {
  StorefrontFrequentShowcaseSection,
  StorefrontPopularShowcaseSection,
} from "@/components/storefront/menu-showcase-rails";
import type { StorefrontFrequentPlacement } from "@/lib/storefront-menu-showcase-resolve";

type Product = {
  id: number;
  nameTR: string;
  nameEN: string | null;
  descriptionTR: string | null;
  descriptionEN: string | null;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  isFeatured?: boolean;
  trackStock?: boolean;
  stockQuantity?: number;
  categoryId: number;
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
      priceDelta: number;
    }[];
  }[];
};

type CategoryWithProducts = {
  id: number;
  nameTR: string;
  nameEN: string | null;
  products: Product[];
};

type RestaurantData = {
  name: string;
  logoUrl: string | null;
  orderingClosed?: boolean;
  openingHour?: string | null;
  closingHour?: string | null;
  themeColor?: "primary" | "secondary";
  menuFontSizePx?: number | null;
  menuTextColor?: string | null;
  menuBackgroundColor?: string | null;
  menuButtonBackgroundColor?: string | null;
  menuHeaderBackgroundColor?: string | null;
  paymentMethods: {
    cash: boolean;
    creditCard: boolean;
    iyzico: boolean;
  };
  canRequestBill?: boolean;
  unpaidTotal?: number;
  locationEnforcementEnabled?: boolean;
  orderRadiusMeters?: number;
  locationLatitude?: number | null;
  locationLongitude?: number | null;
};

type OrderItemDisplay = {
  productName: string;
  productNameEN: string | null;
  quantity: number;
  price: number;
};

type MyOrder = {
  id: number;
  status: string;
  statusLabel: string;
  createdAt: string;
  note: string | null;
  items: OrderItemDisplay[];
};

type MenuData = {
  restaurant: RestaurantData;
  categories: CategoryWithProducts[];
  popularByCategory?: Record<
    number,
    {
      title: string;
      subtitle: string | null;
      products: Product[];
      autoplayEnabled: boolean;
      autoplaySpeed: "SLOW" | "NORMAL";
    }
  >;
  frequentShowcase?: {
    title: string;
    subtitle: string | null;
    products: Product[];
    placement: StorefrontFrequentPlacement;
  } | null;
  tableId: string;
  myOrders?: MyOrder[];
};

type SelectedOptionGroup = { groupId: number; optionIds: number[] };
type CartItem = Product & { quantity: number; selectedOptions?: SelectedOptionGroup[] };
type CustomerLocation = {
  latitude: number;
  longitude: number;
  accuracyMeters?: number | null;
  capturedAtMs?: number | null;
};

export default function MenuClient({ data }: { data: MenuData }) {
  const router = useRouter();
  const {
    restaurant,
    categories,
    tableId,
    popularByCategory = {},
    frequentShowcase = null,
  } = data;
  const menuTheme = resolveMenuTheme({
    themeColor: restaurant.themeColor,
    menuFontSizePx: restaurant.menuFontSizePx,
    menuTextColor: restaurant.menuTextColor,
    menuBackgroundColor: restaurant.menuBackgroundColor,
    menuButtonBackgroundColor: restaurant.menuButtonBackgroundColor,
    menuHeaderBackgroundColor: restaurant.menuHeaderBackgroundColor,
  });
  const [language, setLanguage] = useState<"TR" | "EN">("TR");
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id || 0);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartModalOpen, setIsCartModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCallingWaiter, setIsCallingWaiter] = useState(false);
  const [isRequestingPaymentMethod, setIsRequestingPaymentMethod] = useState(false);
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<CustomerPaymentMethod | null>(null);
  const [isMyOrdersOpen, setIsMyOrdersOpen] = useState(false);
  const [optionModalProduct, setOptionModalProduct] = useState<Product | null>(null);
  const [optionSelections, setOptionSelections] = useState<Record<number, number[]>>({});
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [verifiedLocation, setVerifiedLocation] = useState<CustomerLocation | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    "idle" | "verified" | "denied" | "unavailable" | "out_of_range" | "error"
  >("idle");
  const [locationStatusMessage, setLocationStatusMessage] = useState("");
  const [locationDistanceMeters, setLocationDistanceMeters] = useState<number | null>(null);

  const isProductOutOfStock = (product: Product) =>
    !product.isAvailable || (product.trackStock === true && (product.stockQuantity ?? 0) <= 0);

  const orderingClosed = restaurant.orderingClosed ?? false;
  const requiresLocationEnforcement =
    restaurant.locationEnforcementEnabled === true;
  const locationRadiusMeters = restaurant.orderRadiusMeters
    ? Math.min(
        MAX_ORDER_RADIUS_METERS,
        Math.max(MIN_ORDER_RADIUS_METERS, Math.round(restaurant.orderRadiusMeters)),
      )
    : 100;
  const restaurantLatitude =
    restaurant.locationLatitude != null ? Number(restaurant.locationLatitude) : null;
  const restaurantLongitude =
    restaurant.locationLongitude != null ? Number(restaurant.locationLongitude) : null;
  const myOrders = useMemo(() => data.myOrders ?? [], [data.myOrders]);
  const canUseIyzicoForOrder = restaurant.paymentMethods.iyzico;
  const hasAnyBillPaymentMethod =
    restaurant.paymentMethods.cash ||
    restaurant.paymentMethods.creditCard ||
    restaurant.paymentMethods.iyzico;
  const unpaidTotal = Number.isFinite(restaurant.unpaidTotal)
    ? Math.max(0, Number(restaurant.unpaidTotal))
    : 0;
  const canRequestBill = restaurant.canRequestBill === true && unpaidTotal > 0;
  const seenCompletedIdsRef = useRef<Set<number>>(new Set());
  const rootStyle = {
    fontSize: `${menuTheme.fontSizePx}px`,
  };
  const accentTextStyle = { color: menuTheme.buttonBackgroundColor };

  useEffect(() => {
    if (selectedPaymentMethod === "IYZICO" && !canUseIyzicoForOrder) {
      setSelectedPaymentMethod("PAY_LATER");
      return;
    }
    if (!selectedPaymentMethod) {
      setSelectedPaymentMethod("PAY_LATER");
    }
  }, [canUseIyzicoForOrder, selectedPaymentMethod]);

  useEffect(() => {
    const completedIds = new Set(
      myOrders.filter((o) => o.status === "COMPLETED").map((o) => o.id),
    );
    if (seenCompletedIdsRef.current.size === 0) {
      seenCompletedIdsRef.current = new Set(completedIds);
      return;
    }
    completedIds.forEach((id) => {
      if (!seenCompletedIdsRef.current.has(id)) {
        toast.success("Siparişiniz hazır!", { duration: 5000 });
        playOrderAlertBeep();
      }
    });
    seenCompletedIdsRef.current = new Set(completedIds);
  }, [myOrders]);

  const handleAddToCart = (product: Product) => {
    if (orderingClosed) return;
    if (isProductOutOfStock(product)) return;
    if (!product.optionGroups || product.optionGroups.length === 0) {
      setCart((prevCart) => {
        const existingItem = prevCart.find((item) => item.id === product.id);
        if (existingItem) {
          return prevCart.map((item) =>
            item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
          );
        }
        return [...prevCart, { ...product, quantity: 1 }];
      });
      return;
    }
    setOptionModalProduct(product);
    setOptionSelections({});
  };

  const handleOptionSelectionChange = (
    groupId: number,
    optionId: number,
    isSingle: boolean,
    checked: boolean,
  ) => {
    setOptionSelections((prev) => {
      const current = prev[groupId] ?? [];
      if (isSingle) {
        return { ...prev, [groupId]: [optionId] };
      }
      const next = checked
        ? current.includes(optionId)
          ? current
          : [...current, optionId]
        : current.filter((id) => id !== optionId);
      return { ...prev, [groupId]: next };
    });
  };

  const closeOptionModal = () => {
    setOptionModalProduct(null);
    setOptionSelections({});
  };

  const handleConfirmOptionSelection = () => {
    if (!optionModalProduct) return;

    for (const group of optionModalProduct.optionGroups ?? []) {
      const selected = optionSelections[group.id] ?? [];
      const count = selected.length;
      if (group.minSelect > 0 && count < group.minSelect) {
        toast.error(
          `${t(group.nameTR, group.nameEN)} icin en az ${group.minSelect} secim yapin.`,
        );
        return;
      }
      if (group.maxSelect !== null && count > group.maxSelect) {
        toast.error(
          `${t(group.nameTR, group.nameEN)} icin en fazla ${group.maxSelect} secim yapabilirsiniz.`,
        );
        return;
      }
    }

    const selectedOptions: SelectedOptionGroup[] = Object.entries(optionSelections)
      .map(([groupId, optionIds]) => ({
        groupId: Number(groupId),
        optionIds,
      }))
      .filter((group) => group.optionIds.length > 0);

    setCart((prevCart) => {
      return [
        ...prevCart,
        {
          ...optionModalProduct,
          quantity: 1,
          selectedOptions,
        },
      ];
    });
    closeOptionModal();
  };

  const handleUpdateQuantity = (cartIndex: number, amount: number) => {
    setCart((prevCart) => {
      const updatedCart = prevCart.map((item, index) => {
        if (index === cartIndex) {
          return { ...item, quantity: Math.max(0, item.quantity + amount) };
        }
        return item;
      });
      return updatedCart.filter((item) => item.quantity > 0);
    });
  };

  const linePrice = (item: CartItem) => {
    const base = item.price;
    const extra =
      item.selectedOptions?.reduce((sum, selectedGroup) => {
        const group = item.optionGroups?.find((g) => g.id === selectedGroup.groupId);
        if (!group) return sum;
        const groupExtra = selectedGroup.optionIds.reduce((inner, optionId) => {
          const option = group.options.find((o) => o.id === optionId);
          return inner + (option?.priceDelta ?? 0);
        }, 0);
        return sum + groupExtra;
      }, 0) ?? 0;
    return (base + extra) * item.quantity;
  };

  const total = cart.reduce((sum, item) => sum + linePrice(item), 0);
  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  const filteredProducts = useMemo(() => {
    const activeCat = categories.find((category) => category.id === activeCategory);
    return activeCat ? activeCat.products : [];
  }, [activeCategory, categories]);

  const popularForActiveCategory = popularByCategory[activeCategory];

  const getSelectedOptionsSummary = (item: CartItem) => {
    if (!item.selectedOptions || item.selectedOptions.length === 0) return null;
    const labels = item.selectedOptions.flatMap((groupSelection) => {
      const group = item.optionGroups?.find((g) => g.id === groupSelection.groupId);
      if (!group) return [];
      return groupSelection.optionIds
        .map((optionId) => group.options.find((option) => option.id === optionId))
        .filter((option): option is NonNullable<typeof option> => Boolean(option))
        .map((option) => t(option.nameTR, option.nameEN));
    });
    return labels.length > 0 ? labels.join(", ") : null;
  };

  const verifyOrderLocation = async (): Promise<CustomerLocation | null> => {
    if (!requiresLocationEnforcement) {
      setLocationStatus("idle");
      setLocationStatusMessage("");
      setLocationDistanceMeters(null);
      return null;
    }

    if (
      restaurantLatitude == null ||
      restaurantLongitude == null ||
      !Number.isFinite(restaurantLatitude) ||
      !Number.isFinite(restaurantLongitude)
    ) {
      setLocationStatus("error");
      setLocationStatusMessage(
        "Restoran konum ayarları eksik. Lütfen işletme yöneticisine basvurun.",
      );
      return null;
    }

    if (!("geolocation" in navigator)) {
      setLocationStatus("unavailable");
      setLocationStatusMessage(
        "Konum bilgisi alınamadı. Sipariş için konum doğrulaması gerekli.",
      );
      return null;
    }

    setIsCheckingLocation(true);
    const location = await new Promise<CustomerLocation | null>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy ?? null,
            capturedAtMs:
              typeof position.timestamp === "number"
                ? position.timestamp
                : Date.now(),
          });
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            setLocationStatus("denied");
            setLocationStatusMessage(
              "Konum izni olmadan Sipariş verilemez. Lütfen konum izni veriniz.",
            );
          } else {
            setLocationStatus("unavailable");
            setLocationStatusMessage(
              "Konum alınamadı. Lütfen tekrar deneyin.",
            );
          }
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
      );
    });
    setIsCheckingLocation(false);

    if (!location) {
      setVerifiedLocation(null);
      setLocationDistanceMeters(null);
      return null;
    }

    const distanceMeters = calculateDistanceMeters(
      restaurantLatitude,
      restaurantLongitude,
      location.latitude,
      location.longitude,
    );
    setLocationDistanceMeters(distanceMeters);

    if (distanceMeters > locationRadiusMeters) {
      setLocationStatus("out_of_range");
      setLocationStatusMessage(
        `Sipariş verebilmek için restoranda bulunmanız gerekiyor. Mesafe: ${Math.round(distanceMeters)} m, limit: ${locationRadiusMeters} m.`,
      );
      setVerifiedLocation(null);
      return null;
    }

    setLocationStatus("verified");
    setLocationStatusMessage(
      `Konum doğrulandı (${Math.round(distanceMeters)} m / ${locationRadiusMeters} m).`,
    );
    setVerifiedLocation(location);
    return location;
  };

  const handleCreateOrder = async () => {
    if (isSubmitting || cart.length === 0) return;
    if (orderingClosed) {
      toast.error("Şu an sipariş alınamıyor.");
      return;
    }
    if (!selectedPaymentMethod) {
      toast.error("Lütfen ödeme yöntemi seçin");
      return;
    }

    const verified = await verifyOrderLocation();
    if (requiresLocationEnforcement && !verified) {
      toast.error("Sipariş verebilmek için konumunuzun açık olması gerekmekte.");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading("Siparişiniz oluşuyor...");

    try {
      const result = await createOrder(
        cart,
        tableId,
        total,
        verified ?? null,
        buildClientRiskSignals({
          location: (verified ?? verifiedLocation)
            ? {
                latitude: (verified ?? verifiedLocation)!.latitude,
                longitude: (verified ?? verifiedLocation)!.longitude,
                accuracyMeters:
                  (verified ?? verifiedLocation)!.accuracyMeters ?? null,
                capturedAtMs:
                  (verified ?? verifiedLocation)!.capturedAtMs ?? Date.now(),
              }
            : null,
        }),
        selectedPaymentMethod,
      );
      if (result.success) {
        toast.success(result.message, { id: toastId });
        setCart([]);
        setIsCartModalOpen(false);
        if (result.redirectUrl) {
          if (/^https?:\/\//i.test(result.redirectUrl)) {
            window.location.assign(result.redirectUrl);
          } else {
            router.push(result.redirectUrl);
          }
          return;
        }
        router.refresh();
      } else {
        toast.error(result.message || "Bir hata oluştu.", { id: toastId });
      }
    } catch {
      toast.error("Sipariş oluştururken bir hata oluştu. Lütfen garson çağırın.", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRequestWaiter = async () => {
    if (isCallingWaiter) return;
    setIsCallingWaiter(true);
    const toastId = toast.loading("Garson çağırma isteğiniz iletiliyor...");
    try {
      const res = await fetch("/api/table-session/waiter-call", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableId,
          riskSignals: buildClientRiskSignals({
            location: verifiedLocation
              ? {
                  latitude: verifiedLocation.latitude,
                  longitude: verifiedLocation.longitude,
                  accuracyMeters: verifiedLocation.accuracyMeters ?? null,
                  capturedAtMs: verifiedLocation.capturedAtMs ?? Date.now(),
                }
              : null,
          }),
        }),
      });
      const result = (await res.json()) as {
        success: boolean;
        message?: string;
        rateLimit?: { retryAfterSeconds: number | null; code: string };
      };
      if (result.success) {
        toast.success(result.message ?? "Tamam.", { id: toastId });
      } else {
        const retry =
          result.rateLimit?.retryAfterSeconds != null
            ? ` (${result.rateLimit.retryAfterSeconds} sn sonra tekrar deneyin)`
            : "";
        toast.error((result.message ?? "İşlem yapılamadı.") + retry, { id: toastId });
      }
    } catch {
      toast.error("Garson çağırma isteği sırasında bir hata oluştu. bir kaç saniye sonra tekrar deneyin.", {
        id: toastId,
      });
    } finally {
      setIsCallingWaiter(false);
    }
  };

  const handleOpenPaymentModal = () => {
    if (!canRequestBill) {
      toast.error("Hesap Bakiyeniz bulunmamakta");
      return;
    }
    if (!hasAnyBillPaymentMethod) {
      toast.error("aktif ödeme yöntemi bulunmuyor.");
      return;
    }
    setIsPaymentMethodModalOpen(true);
  };

  const handleRequestBillWithMethod = async (
    method: Exclude<CustomerPaymentMethod, "PAY_LATER">,
  ) => {
    if (isRequestingPaymentMethod) return;
    setIsRequestingPaymentMethod(true);
    const toastId = toast.loading("Ödeme işlemi başlatılıyor...");
    try {
      const result = await requestBillWithMethod(
        tableId,
        method,
        buildClientRiskSignals({
          location: verifiedLocation
            ? {
                latitude: verifiedLocation.latitude,
                longitude: verifiedLocation.longitude,
                accuracyMeters: verifiedLocation.accuracyMeters ?? null,
                capturedAtMs: verifiedLocation.capturedAtMs ?? Date.now(),
              }
            : null,
        }),
      );
      if (result.success) {
        toast.success(result.message, { id: toastId });
        setIsPaymentMethodModalOpen(false);
        if ("redirectUrl" in result && result.redirectUrl) {
          window.location.href = result.redirectUrl;
          return;
        }
        router.refresh();
      } else {
        toast.error(result.message, { id: toastId });
      }
    } catch {
      toast.error("Ödeme işleminde hata oluştu. lütfen garson çağırın.", {
        id: toastId,
      });
    } finally {
      setIsRequestingPaymentMethod(false);
    }
  };

  const t = (tr: string | null | undefined, en: string | null | undefined) => {
    const fallback = tr || "";
    return language === "TR" ? fallback : en || fallback;
  };

  const heroSubtitle =
    restaurant.openingHour && restaurant.closingHour
      ? t(
          `Çalışma saatleri: ${restaurant.openingHour} – ${restaurant.closingHour}`,
          `Hours: ${restaurant.openingHour} – ${restaurant.closingHour}`,
        )
      : t("Keyifli bir deneyim dileriz.", "We hope you enjoy your visit.");

  const handleCopyMenuLink = async () => {
    if (typeof window === "undefined") return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(t("Menü bağlantısı kopyalandı.", "Menu link copied."));
    } catch {
      toast.error(t("Bağlantı kopyalanamadı.", "Could not copy link."));
    }
  };

  const handleBillOutlineClick = () => {
    if (unpaidTotal <= 0) {
      toast(t("Şu an hesapta bakiye görünmüyor.", "No balance on your bill yet."), { icon: "ℹ️" });
      return;
    }
    handleOpenPaymentModal();
  };

  return (
    <div className="storefront-menu min-h-screen pb-40 font-sans text-[#2d251d]" style={rootStyle}>
      <Toaster position="top-center" />

      <div className="storefront-ref-sticky sticky top-0 z-20">
        <div className="mx-auto w-full max-w-2xl px-3 pt-2 sm:px-4">
          <div className="storefront-shell overflow-hidden rounded-2xl p-3 sm:p-4">
            {orderingClosed ? (
              <div
                className="storefront-order-strip -mx-3 -mt-3 mb-2 rounded-t-2xl sm:-mx-4 sm:-mt-4"
                role="status"
              >
                {t("Şu an sipariş alınmıyor.", "Not taking orders right now.")}
                {restaurant.openingHour && restaurant.closingHour ? (
                  <>
                    {" · "}
                    <span className="font-medium text-[#5c3d18]">
                      {restaurant.openingHour}–{restaurant.closingHour}
                    </span>
                  </>
                ) : null}
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8a7a68]">
                  {t("Masa", "Table")} {tableId}
                </span>
                <span className="text-[#d4c9bc]">·</span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-px text-[10px] font-semibold ${
                    orderingClosed ? "storefront-status-closed" : "storefront-status-open"
                  }`}
                >
                  {orderingClosed
                    ? t("Kapalı", "Closed")
                    : t("Siparişe açık", "Open")}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setIsMyOrdersOpen(true)}
                  className="storefront-qr-tile"
                  title={t("Siparişlerim", "My orders")}
                  aria-label={t("Siparişlerim", "My orders")}
                >
                  <ClipboardList className="h-[15px] w-[15px]" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopyMenuLink()}
                  className="storefront-qr-tile flex h-auto min-h-[2.5rem] flex-col justify-center gap-px py-1"
                  aria-label={t("Menü bağlantısını kopyala", "Copy menu link")}
                >
                  <QrCode className="h-[15px] w-[15px]" aria-hidden />
                  <span className="text-[8px] font-bold leading-none text-[#7a6651]">QR</span>
                </button>
              </div>
            </div>
            <h1 className="mt-2 text-xl font-bold leading-snug tracking-tight text-[#1a1814] sm:text-2xl">
              {restaurant.name}
            </h1>
            <p className="mt-0.5 text-[13px] leading-snug text-[#7a6a58]">{heroSubtitle}</p>
            <div className="mt-2.5 flex flex-row items-stretch gap-2">
              <button
                type="button"
                onClick={handleRequestWaiter}
                disabled={isCallingWaiter}
                className="storefront-btn-waiter-outline min-w-0 flex-1"
                title={t("Garson çağır", "Call waiter")}
              >
                <Coffee className="h-3.5 w-3.5 shrink-0 text-[#c9853f]" aria-hidden />
                <span className="truncate">{t("Garson", "Waiter")}</span>
              </button>
              <button
                type="button"
                onClick={handleBillOutlineClick}
                disabled={isRequestingPaymentMethod}
                className="storefront-btn-bill-outline min-w-0 flex-1"
                title={t("Hesap ve ödeme", "Bill & payment")}
              >
                <Monitor className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
                <span className="truncate">{t("Hesap", "Bill")}</span>
              </button>
              <button
                type="button"
                onClick={() => setLanguage((lang) => (lang === "TR" ? "EN" : "TR"))}
                className="storefront-lang-toggle"
                aria-label={t("Dil değiştir", "Change language")}
              >
                {language === "TR" ? "TR · EN" : "EN · TR"}
              </button>
            </div>
            {unpaidTotal > 0 ? (
              <p className="mt-2 text-center text-[11px] font-medium text-[#8a7460]">
                {t("Açık hesap", "Open tab")}{" "}
                <span className="font-semibold text-[#1a1814]">{unpaidTotal.toFixed(2)} TL</span>
              </p>
            ) : null}
          </div>
        </div>
        {frequentShowcase &&
        frequentShowcase.products.length > 0 &&
        frequentShowcase.placement === "ABOVE_CATEGORIES" ? (
          <div className="mx-auto w-full max-w-2xl px-3 pt-1 sm:px-4">
            <StorefrontFrequentShowcaseSection
              title={frequentShowcase.title}
              subtitle={frequentShowcase.subtitle}
              products={frequentShowcase.products}
              language={language}
              t={t}
              orderingClosed={orderingClosed}
              isProductOutOfStock={isProductOutOfStock}
              onAddToCart={handleAddToCart}
              accentColor={menuTheme.buttonBackgroundColor}
              placement={frequentShowcase.placement}
            />
          </div>
        ) : null}
        <nav className="px-3 pb-2 pt-1 sm:px-4" aria-label={t("Kategoriler", "Categories")}>
          <div className="mx-auto w-full max-w-2xl overflow-x-auto [-webkit-overflow-scrolling:touch]">
            <div className="flex min-w-0 gap-1.5 pb-0.5">
              {categories.map((category) => (
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
      </div>

      {frequentShowcase &&
      frequentShowcase.products.length > 0 &&
      (frequentShowcase.placement === "BELOW_CATEGORIES" ||
        frequentShowcase.placement === "BLOCK") ? (
        <div className="mx-auto w-full max-w-2xl px-3 pt-2 sm:px-4">
          <StorefrontFrequentShowcaseSection
            title={frequentShowcase.title}
            subtitle={frequentShowcase.subtitle}
            products={frequentShowcase.products}
            language={language}
            t={t}
            orderingClosed={orderingClosed}
            isProductOutOfStock={isProductOutOfStock}
            onAddToCart={handleAddToCart}
            accentColor={menuTheme.buttonBackgroundColor}
            placement={frequentShowcase.placement}
          />
        </div>
      ) : null}

      {frequentShowcase &&
      frequentShowcase.products.length > 0 &&
      frequentShowcase.placement === "STICKY" ? (
        <div className="sticky top-[4.25rem] z-[12] max-h-[min(40vh,13.5rem)] overflow-y-auto border-b border-[#e8dfd2] bg-[#f6f1e9]/95 py-2 backdrop-blur-sm shadow-sm sm:top-[4.75rem]">
          <div className="mx-auto w-full max-w-2xl px-3 sm:px-4">
            <StorefrontFrequentShowcaseSection
              title={frequentShowcase.title}
              subtitle={frequentShowcase.subtitle}
              products={frequentShowcase.products}
              language={language}
              t={t}
              orderingClosed={orderingClosed}
              isProductOutOfStock={isProductOutOfStock}
              onAddToCart={handleAddToCart}
              accentColor={menuTheme.buttonBackgroundColor}
              placement={frequentShowcase.placement}
            />
          </div>
        </div>
      ) : null}

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-3 pb-28 pt-3 sm:px-4">
        {popularForActiveCategory && popularForActiveCategory.products.length > 0 ? (
          <StorefrontPopularShowcaseSection
            title={popularForActiveCategory.title}
            subtitle={popularForActiveCategory.subtitle}
            products={popularForActiveCategory.products}
            language={language}
            t={t}
            orderingClosed={orderingClosed}
            isProductOutOfStock={isProductOutOfStock}
            onAddToCart={handleAddToCart}
            accentColor={menuTheme.buttonBackgroundColor}
            autoplayEnabled={popularForActiveCategory.autoplayEnabled}
            autoplaySpeed={popularForActiveCategory.autoplaySpeed}
          />
        ) : null}
        {filteredProducts.length === 0 ? (
          <div className="storefront-info rounded-2xl p-6 text-center">
            <p className="text-base font-semibold">{t("Bu kategoride ürün yok.", "No items in this category.")}</p>
            <p className="mt-1 text-sm text-[#7a6550]">{t("Lütfen başka bir kategori seçin.", "Please choose another category.")}</p>
          </div>
        ) : null}
        {filteredProducts.map((product) => {
          const outOfStock = isProductOutOfStock(product);
          const displayName = t(product.nameTR, product.nameEN);
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
                    {displayName}
                  </h2>
                  <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-[#7a6a58]">
                    {t(product.descriptionTR, product.descriptionEN) || "\u00a0"}
                  </p>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-base font-bold tabular-nums tracking-tight text-[#1a1814] sm:text-[1.0625rem]">
                    {product.price.toFixed(2)} TL
                  </p>
                  {!outOfStock ? (
                    <button
                      type="button"
                      onClick={() => handleAddToCart(product)}
                      disabled={orderingClosed}
                      className="storefront-product-add"
                    >
                      <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
                      {t("Ekle", "Add")}
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
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-full border border-[#d9cfc3] bg-[#fffcf7] shadow-sm"
                      aria-hidden
                    >
                      <UtensilsCrossed
                        className="h-5 w-5 text-[#c9853f] opacity-90"
                        strokeWidth={2.25}
                      />
                    </div>
                  </div>
                )}
                {outOfStock && product.imageUrl ? (
                  <div className="pointer-events-none absolute inset-0 bg-black/28" aria-hidden />
                ) : null}
              </div>
            </article>
          );
        })}
      </main>

      {cart.length > 0 ? (
        <button
          type="button"
          onClick={() => setIsCartModalOpen(true)}
          className="storefront-sticky-cart-dark fixed bottom-3 left-1/2 z-30 flex w-[min(100%-1.5rem,28rem)] max-w-full -translate-x-1/2 cursor-pointer items-center gap-2 rounded-[1rem] px-2.5 py-2 text-left sm:gap-2.5 sm:px-3 sm:py-2.5 [padding-bottom:calc(0.625rem+env(safe-area-inset-bottom))]"
        >
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#c9853f] text-sm font-extrabold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]">
            {totalItems}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-white/55">
              {t("Sepetiniz", "Your cart")}
            </p>
            <p className="truncate text-lg font-bold tabular-nums text-white">{total.toFixed(2)} TL</p>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 rounded-xl bg-[#c9853f] px-3 py-2.5 text-xs font-semibold text-white sm:gap-1 sm:px-3.5 sm:text-sm">
            <span className="whitespace-nowrap">{t("Sepeti Gör", "View cart")}</span>
            <ChevronRight className="h-4 w-4 opacity-90" aria-hidden />
          </div>
        </button>
      ) : null}

      {isCartModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-0 sm:items-center sm:p-4">
          <div className="storefront-sheet flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-[#eadfce] p-4">
              <h2 className="text-xl font-bold">{t("Sepetim", "My Cart")}</h2>
              <button onClick={() => setIsCartModalOpen(false)} className="text-[#6b5845]">
                X
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              {cart.map((item, index) => (
                <div key={`${item.id}-${index}`} className="mb-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {item.imageUrl ? (
                      <Image
                        src={item.imageUrl}
                        alt={t(item.nameTR, item.nameEN)}
                        width={60}
                        height={60}
                        className="rounded-lg object-cover"
                      />
                    ) : null}
                    <div>
                      <p className="font-semibold">{t(item.nameTR, item.nameEN)}</p>
                      {getSelectedOptionsSummary(item) && (
                        <p className="text-xs text-[#7a6651]">{getSelectedOptionsSummary(item)}</p>
                      )}
                      <p className="font-bold" style={accentTextStyle}>
                        {linePrice(item).toFixed(2)} TL
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3 rounded-full bg-[#f6ecdf] p-1">
                    <button onClick={() => handleUpdateQuantity(index, -1)} className="p-1">
                      <Minus size={16} />
                    </button>
                    <span className="w-4 text-center font-bold">{item.quantity}</span>
                    <button onClick={() => handleUpdateQuantity(index, 1)} className="p-1">
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-auto border-t border-[#eadfce] p-4">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-lg font-semibold">{t("Toplam", "Total")}</span>
                <span className="text-2xl font-extrabold" style={accentTextStyle}>
                  {total.toFixed(2)} TL
                </span>
              </div>
              {requiresLocationEnforcement && (
                <div className="mb-3 rounded-lg border border-[#eadfce] bg-[#fff8ed] p-3 text-xs text-[#6c5846]">
                  <p className="font-semibold">
                    Sipariş verebilmek için konum doğrulaması gerekir.
                  </p>
                  <p className="mt-1">Maksimum mesafe: {locationRadiusMeters} m</p>
                  {locationStatusMessage && (
                    <p
                      className={`mt-1 font-medium ${
                        locationStatus === "verified"
                          ? "text-emerald-700"
                          : "text-amber-700"
                      }`}
                    >
                      {locationStatusMessage}
                    </p>
                  )}
                  {locationDistanceMeters != null && (
                    <p className="mt-1 text-[11px] text-[#8a7460]">
                      Son ölçülen mesafe: {Math.round(locationDistanceMeters)} m
                    </p>
                  )}
                </div>
              )}
              <div className="mb-3 rounded-lg border border-[#eadfce] bg-[#fff8ed] p-3 text-xs text-[#6c5846]">
                <p className="font-semibold">Ödeme tercihi</p>
                <p className="mt-1 text-[11px] text-[#8a7460]">
                  Sipariş aşamasında online ödeyebilir veya masanıza yazdırabilirsiniz.
                </p>
                <div className="mt-3 grid gap-2">
                  {canUseIyzicoForOrder && (
                    <button
                      type="button"
                      onClick={() => setSelectedPaymentMethod("IYZICO")}
                      className={`rounded-lg border px-3 py-2 text-left transition ${
                        selectedPaymentMethod === "IYZICO"
                          ? "border-[#c98b4a] bg-[#fff0dc]"
                          : "border-[#e1d1bc] bg-[#fffaf2]"
                      }`}
                    >
                      <p className="text-sm font-semibold">Iyzico ile Öde</p>
                      <p className="mt-0.5 text-[11px] text-[#8a7460]">
                        Online ödeme, siparisten sonra ödeme sayfasina yonlendirir.
                      </p>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedPaymentMethod("PAY_LATER")}
                    className={`rounded-lg border px-3 py-2 text-left transition ${
                      selectedPaymentMethod === "PAY_LATER"
                        ? "border-[#c98b4a] bg-[#fff0dc]"
                        : "border-[#e1d1bc] bg-[#fffaf2]"
                    }`}
                  >
                    <p className="text-sm font-semibold">Sonra Öde</p>
                    <p className="mt-0.5 text-[11px] text-[#8a7460]">
                      Sipariş masanızın hesabına yazılır, Ödeme hesap isterken seçilir.
                    </p>
                  </button>
                </div>
                {!canUseIyzicoForOrder && (
                  <p className="mt-2 text-[11px] text-[#8a7460]">
                    Iyzico şu an aktif değil. Siparişler Sonra Öde olarak alınacaktır.
                  </p>
                )}
              </div>
              <button
                onClick={handleCreateOrder}
                disabled={
                  isSubmitting ||
                  isCheckingLocation ||
                  !selectedPaymentMethod
                }
                className="storefront-primary-btn w-full rounded-lg py-3 text-lg font-bold disabled:opacity-50"
              >
                {isCheckingLocation
                  ? t("Konum kontrol ediliyor...", "Validating location...")
                  : isSubmitting
                    ? t("Gönderiliyor...", "Submitting...")
                    : t("Siparişi Onayla", "Confirm Order")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isPaymentMethodModalOpen ? (
        <div className="fixed inset-0 z-[55] flex items-end justify-center bg-black/75 p-0 sm:items-center sm:p-4">
          <div className="storefront-sheet w-full max-w-sm rounded-t-3xl p-4 sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">
                {t("Ödeme Yöntemi Seçin", "Choose Payment Method")}
              </h3>
              <button
                type="button"
                onClick={() => setIsPaymentMethodModalOpen(false)}
                className="rounded-md px-2 py-1 text-[#6b5845] hover:bg-[#f7ecdf]"
              >
                X
              </button>
            </div>
            {!hasAnyBillPaymentMethod ? (
              <p className="text-sm text-amber-300">
                Bu restoran için aktif ödeme yontemi bulunmuyor.
              </p>
            ) : (
              <div className="space-y-2">
                {restaurant.paymentMethods.cash && (
                  <button
                    type="button"
                    onClick={() => handleRequestBillWithMethod("CASH")}
                    disabled={isRequestingPaymentMethod}
                    className="storefront-primary-btn w-full rounded-lg px-3 py-2 text-left text-sm font-semibold disabled:opacity-60"
                  >
                    {t("Nakit", "Cash")}
                  </button>
                )}
                {restaurant.paymentMethods.creditCard && (
                  <button
                    type="button"
                    onClick={() => handleRequestBillWithMethod("CREDIT_CARD")}
                    disabled={isRequestingPaymentMethod}
                    className="storefront-primary-btn w-full rounded-lg px-3 py-2 text-left text-sm font-semibold disabled:opacity-60"
                  >
                    {t("Kredi kartı", "Credit Card")}
                  </button>
                )}
                {restaurant.paymentMethods.iyzico && (
                  <button
                    type="button"
                    onClick={() => handleRequestBillWithMethod("IYZICO")}
                    disabled={isRequestingPaymentMethod}
                    className="storefront-primary-btn w-full rounded-lg px-3 py-2 text-left text-sm font-semibold disabled:opacity-60"
                  >
                    {t("Iyzico ile ödeme", "Pay with Iyzico")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {optionModalProduct ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4">
          <div className="storefront-sheet w-full max-w-lg rounded-t-3xl p-4 shadow-2xl sm:rounded-2xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {t(optionModalProduct.nameTR, optionModalProduct.nameEN)}
                </h3>
                <p className="text-xs text-[#7a6651]">{t("Seceneklerini sec", "Choose options")}</p>
              </div>
              <button
                type="button"
                onClick={closeOptionModal}
                className="rounded-md px-2 py-1 text-sm text-[#6b5845] hover:bg-[#f7ecdf]"
              >
                X
              </button>
            </div>

            <div className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
              {(optionModalProduct.optionGroups ?? []).map((group) => {
                const isSingle = group.minSelect === 1 && group.maxSelect === 1;
                const selected = optionSelections[group.id] ?? [];
                return (
                  <div key={group.id} className="rounded-xl border border-[#eadfce] bg-[#fff9ef] p-3">
                    <div className="mb-2">
                      <p className="text-sm font-semibold text-[#2d251d]">
                        {t(group.nameTR, group.nameEN)}
                      </p>
                      <p className="text-xs text-[#7e6a54]">
                        Min: {group.minSelect} / Max: {group.maxSelect === null ? "Sinirsiz" : group.maxSelect}
                        {group.isRequired ? " (zorunlu)" : ""}
                      </p>
                    </div>

                    <div className="space-y-2">
                      {group.options.map((option) => {
                        const checked = selected.includes(option.id);
                        const disableDueToMax =
                          !isSingle &&
                          !checked &&
                          group.maxSelect !== null &&
                          selected.length >= group.maxSelect;
                        return (
                          <label
                            key={option.id}
                            className={`flex cursor-pointer items-center justify-between rounded-lg border px-2 py-1.5 text-sm ${
                              checked
                                ? "border-[#c98b4a] bg-[#fff0dc] text-[#2d251d]"
                                : "border-[#eadfce] text-[#5f4a35]"
                            } ${disableDueToMax ? "cursor-not-allowed opacity-50" : ""}`}
                          >
                            <span>{t(option.nameTR, option.nameEN)}</span>
                            <div className="flex items-center gap-2">
                              {option.priceDelta > 0 && (
                                <span className="text-xs text-[#a16028]">
                                  +{option.priceDelta.toFixed(2)} TL
                                </span>
                              )}
                              <input
                                type={isSingle ? "radio" : "checkbox"}
                                name={`group-${group.id}`}
                                checked={checked}
                                disabled={disableDueToMax}
                                onChange={(e) =>
                                  handleOptionSelectionChange(
                                    group.id,
                                    option.id,
                                    isSingle,
                                    e.target.checked,
                                  )
                                }
                              />
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={closeOptionModal}
                className="storefront-soft-btn flex-1 rounded-lg px-3 py-2 text-sm font-semibold"
              >
                {t("Vazgeç", "Cancel")}
              </button>
              <button
                type="button"
                onClick={handleConfirmOptionSelection}
                className="storefront-product-add flex-1 rounded-xl text-sm"
              >
                {t("Sepete Ekle", "Add to Cart")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isMyOrdersOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4">
          <div className="storefront-sheet flex max-h-[85vh] w-full max-w-md flex-col rounded-t-3xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-[#eadfce] p-4">
              <h2 className="text-xl font-bold">{t("Siparişlerim", "My Orders")}</h2>
              <button
                onClick={() => setIsMyOrdersOpen(false)}
                className="text-[#6b5845] hover:text-[#2d251d]"
              >
                ✕
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              {myOrders.length === 0 ? (
                <p className="py-6 text-center text-[#6c5846]">
                  {t("Henüz sipariş yok.", "No orders yet.")}
                </p>
              ) : (
                <ul className="space-y-4">
                  {myOrders.map((order) => (
                    <li
                      key={order.id}
                      className="rounded-xl border border-[#eadfce] bg-[#fff9ef] p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs text-[#7a6651]">
                          {new Date(order.createdAt).toLocaleString("tr-TR")}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            order.status === "COMPLETED"
                              ? "bg-[#d9a66a] text-[#2d251d]"
                              : order.status === "REJECTED"
                                ? "bg-[#e8b4a8] text-[#6f1d1b]"
                                : "bg-[#f0d8b1] text-[#5d4123]"
                          }`}
                        >
                          {order.statusLabel}
                        </span>
                      </div>
                      {order.note ? (
                        <p className="mb-2 text-sm text-[#6c5846]">
                          Not: {order.note}
                        </p>
                      ) : null}
                      <ul className="space-y-1 text-sm">
                        {order.items.map((item, idx) => (
                          <li key={idx} className="flex justify-between">
                            <span>
                              {t(item.productName, item.productNameEN)} × {item.quantity}
                            </span>
                            <span style={accentTextStyle}>
                              {(item.price * item.quantity).toFixed(2)} TL
                            </span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}








