"use client";

import React, { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { ChevronDown, Clock3, ImagePlus, MapPin, Palette, Store } from "lucide-react";
import { updateRestaurantSettings } from "@/app/actions/update-restaurant-settings";
import { uploadRestaurantLogo } from "@/app/actions/upload-restaurant-logo";
import { deleteRestaurantLogo } from "@/app/actions/delete-restaurant-logo";
import {
  MAX_ORDER_RADIUS_METERS,
  MIN_ORDER_RADIUS_METERS,
} from "@/lib/location";
import {
  type WeeklyWorkingHourInput,
  WEEKDAY_ORDER,
  WEEKDAY_LABEL_TR,
  normalizeWeeklyWorkingHours,
  validateWeeklyWorkingHoursInput,
} from "@/lib/restaurant-working-hours";
import {
  MAX_MENU_FONT_SIZE_PX,
  MIN_MENU_FONT_SIZE_PX,
  validateMenuThemeInput,
} from "@/lib/menu-theme";
import {
  RESTAURANT_LOGO_MAX_SIZE_BYTES,
  RESTAURANT_LOGO_RECOMMENDED_SIZE_TEXT,
  RESTAURANT_LOGO_TOO_LARGE_MESSAGE,
} from "@/lib/restaurant-logo-config";
import {
  badgeClasses,
  buttonClasses,
  checkboxControlClasses,
  checkboxInputClasses,
  checkboxLabelClasses,
  fieldClasses,
} from "@/lib/ui/button-variants";

type Props = {
  restaurant: {
    id: number;
    name: string;
    logoUrl: string;
    workingHours: WeeklyWorkingHourInput[];
    orderingDisabled: boolean;
    locationEnforcementEnabled: boolean;
    orderRadiusMeters: number;
    locationLatitude: number | null;
    locationLongitude: number | null;
    kitchenWarningYellowMin?: number | null;
    kitchenWarningOrangeMin?: number | null;
    kitchenWarningRedMin?: number | null;
    themeColor: "primary" | "secondary";
    menuFontSizePx: number;
    menuTextColor: string;
    menuBackgroundColor: string;
    menuButtonBackgroundColor: string;
    menuHeaderBackgroundColor: string;
  };
};

const SECTION_CARD_CLASS =
  "rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-bg)] shadow-none";

const INPUT_CLASS = fieldClasses({
  size: "md",
  className: "h-10 rounded-xl px-3 text-sm placeholder:text-[color:var(--ui-text-secondary)]",
});

const TIME_INPUT_CLASS = fieldClasses({
  size: "md",
  className: "h-10 rounded-xl bg-[color:var(--ui-surface-bg)] px-3 text-sm",
});

const PRIMARY_BUTTON_CLASS = buttonClasses({
  variant: "primary",
  size: "md",
  className: "h-10 rounded-xl px-4 disabled:opacity-60",
});

const SECONDARY_BUTTON_CLASS = buttonClasses({
  variant: "secondary",
  size: "md",
  className: "h-10 rounded-xl px-3",
});

const DANGER_BUTTON_CLASS = buttonClasses({
  variant: "danger",
  size: "sm",
  className: "h-8 rounded-lg px-2.5",
});

function workingHourSummary(row: WeeklyWorkingHourInput): string {
  if (!row.isOpen) return "Kapalı";
  if (row.openTime && row.closeTime) return `${row.openTime} - ${row.closeTime}`;
  return "Saat seçimi bekleniyor";
}

function dayStatusBadgeClass(row: WeeklyWorkingHourInput): string {
  if (row.isOpen) {
    return badgeClasses("success");
  }
  return badgeClasses("neutral");
}

export default function SettingsForm({ restaurant }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isUploadingLogo, startUploadingLogo] = useTransition();
  const [isRemovingLogo, startRemovingLogo] = useTransition();
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const initialWorkingHours = normalizeWeeklyWorkingHours(restaurant.workingHours);

  const [name, setName] = useState(restaurant.name);
  const [logoUrl, setLogoUrl] = useState(restaurant.logoUrl);
  const [workingHours, setWorkingHours] = useState<WeeklyWorkingHourInput[]>(initialWorkingHours);
  const [expandedWeekday, setExpandedWeekday] = useState<WeeklyWorkingHourInput["weekday"] | null>(
    initialWorkingHours.find((row) => row.isOpen)?.weekday ?? WEEKDAY_ORDER[0] ?? null,
  );
  const [orderingDisabled, setOrderingDisabled] = useState(restaurant.orderingDisabled);

  const [locationEnforcementEnabled, setLocationEnforcementEnabled] = useState(
    restaurant.locationEnforcementEnabled,
  );
  const [locationLatitude, setLocationLatitude] = useState(
    restaurant.locationLatitude != null ? String(restaurant.locationLatitude) : "",
  );
  const [locationLongitude, setLocationLongitude] = useState(
    restaurant.locationLongitude != null ? String(restaurant.locationLongitude) : "",
  );
  const [orderRadiusMeters, setOrderRadiusMeters] = useState(String(restaurant.orderRadiusMeters || 100));

  const [kitchenYellow, setKitchenYellow] = useState(String(restaurant.kitchenWarningYellowMin ?? "5"));
  const [kitchenOrange, setKitchenOrange] = useState(String(restaurant.kitchenWarningOrangeMin ?? "10"));
  const [kitchenRed, setKitchenRed] = useState(String(restaurant.kitchenWarningRedMin ?? "15"));
  const [themeColor, setThemeColor] = useState<"primary" | "secondary">(restaurant.themeColor ?? "primary");
  const [menuFontSizePx, setMenuFontSizePx] = useState(String(restaurant.menuFontSizePx));
  const [menuTextColor, setMenuTextColor] = useState(restaurant.menuTextColor);
  const [menuBackgroundColor, setMenuBackgroundColor] = useState(restaurant.menuBackgroundColor);
  const [menuButtonBackgroundColor, setMenuButtonBackgroundColor] = useState(
    restaurant.menuButtonBackgroundColor,
  );
  const [menuHeaderBackgroundColor, setMenuHeaderBackgroundColor] = useState(
    restaurant.menuHeaderBackgroundColor,
  );

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > RESTAURANT_LOGO_MAX_SIZE_BYTES) {
      toast.error(RESTAURANT_LOGO_TOO_LARGE_MESSAGE);
      e.target.value = "";
      return;
    }

    startUploadingLogo(async () => {
      const formData = new FormData();
      formData.append("restaurantId", String(restaurant.id));
      formData.append("file", file);

      const result = await uploadRestaurantLogo(formData);
      if (result.success && result.url) {
        setLogoUrl(result.url);
        toast.success("Logo yüklendi. Kaydet ile onaylayın.");
      } else {
        toast.error(result.message ?? "Logo yüklenemedi.");
      }
      e.target.value = "";
    });
  };

  const handleRemoveLogo = () => {
    if (!logoUrl) return;

    startRemovingLogo(async () => {
      const result = await deleteRestaurantLogo(restaurant.id);
      if (result.success) {
        setLogoUrl("");
        toast.success("Logo silindi.");
        router.refresh();
      } else {
        toast.error(result.message ?? "Logo silinemedi.");
      }
    });
  };

  const handleUseCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      toast.error("Tarayıcı konum bilgisini desteklemiyor.");
      return;
    }

    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationLatitude(position.coords.latitude.toFixed(7));
        setLocationLongitude(position.coords.longitude.toFixed(7));
        toast.success("Konum alanları dolduruldu.");
        setIsDetectingLocation(false);
      },
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "Konum izni reddedildi."
            : "Konum alınamadı. Lütfen manuel girin.";
        toast.error(message);
        setIsDetectingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const updateWorkingHourRow = (
    weekday: WeeklyWorkingHourInput["weekday"],
    next: Partial<WeeklyWorkingHourInput>,
  ) => {
    setWorkingHours((prev) =>
      prev.map((row) => {
        if (row.weekday !== weekday) return row;
        return { ...row, ...next };
      }),
    );
  };

  const handleToggleDayOpen = (
    weekday: WeeklyWorkingHourInput["weekday"],
    isOpen: boolean,
  ) => {
    const current = workingHours.find((row) => row.weekday === weekday);
    if (!current) return;

    if (!isOpen) {
      updateWorkingHourRow(weekday, {
        isOpen: false,
        openTime: null,
        closeTime: null,
      });
      return;
    }

    updateWorkingHourRow(weekday, {
      isOpen: true,
      openTime: current.openTime ?? "09:00",
      closeTime: current.closeTime ?? "22:00",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const parsedLat =
      locationLatitude.trim() === ""
        ? null
        : Number(locationLatitude.trim().replace(",", "."));
    const parsedLng =
      locationLongitude.trim() === ""
        ? null
        : Number(locationLongitude.trim().replace(",", "."));
    const parsedRadius = Number.parseInt(orderRadiusMeters, 10);
    const parsedMenuFontSize = Number.parseInt(menuFontSizePx, 10);

    if (parsedLat !== null && (Number.isNaN(parsedLat) || parsedLat < -90 || parsedLat > 90)) {
      toast.error("Enlem -90 ile 90 arasında olmalıdır.");
      return;
    }

    if (parsedLng !== null && (Number.isNaN(parsedLng) || parsedLng < -180 || parsedLng > 180)) {
      toast.error("Boylam -180 ile 180 arasında olmalıdır.");
      return;
    }

    if (
      Number.isNaN(parsedRadius) ||
      parsedRadius < MIN_ORDER_RADIUS_METERS ||
      parsedRadius > MAX_ORDER_RADIUS_METERS
    ) {
      toast.error(
        `Maksimum mesafe ${MIN_ORDER_RADIUS_METERS}-${MAX_ORDER_RADIUS_METERS} aralığında olmalıdır.`,
      );
      return;
    }

    if (locationEnforcementEnabled && (parsedLat === null || parsedLng === null)) {
      toast.error("Konum doğrulaması açıkken restoran koordinatları zorunludur.");
      return;
    }

    const normalizedHours = normalizeWeeklyWorkingHours(workingHours);
    const workingHoursValidation = validateWeeklyWorkingHoursInput(normalizedHours);
    if (!workingHoursValidation.valid) {
      toast.error(workingHoursValidation.message ?? "Çalışma saatleri geçersiz.");
      return;
    }

    const menuThemeValidation = validateMenuThemeInput({
      menuFontSizePx: parsedMenuFontSize,
      menuTextColor,
      menuBackgroundColor,
      menuButtonBackgroundColor,
      menuHeaderBackgroundColor,
    });
    if (!menuThemeValidation.valid) {
      toast.error(menuThemeValidation.message);
      return;
    }

    startTransition(async () => {
      const result = await updateRestaurantSettings({
        restaurantId: restaurant.id,
        name,
        logoUrl: logoUrl || null,
        workingHours: normalizedHours,
        orderingDisabled,
        locationEnforcementEnabled,
        orderRadiusMeters: parsedRadius,
        locationLatitude: parsedLat,
        locationLongitude: parsedLng,
        kitchenWarningYellowMin: Number.parseInt(kitchenYellow, 10) || null,
        kitchenWarningOrangeMin: Number.parseInt(kitchenOrange, 10) || null,
        kitchenWarningRedMin: Number.parseInt(kitchenRed, 10) || null,
        themeColor,
        menuFontSizePx: parsedMenuFontSize,
        menuTextColor,
        menuBackgroundColor,
        menuButtonBackgroundColor,
        menuHeaderBackgroundColor,
      });

      if (result.success) {
        toast.success("Ayarlar kaydedildi.");
        router.refresh();
      } else {
      toast.error(result.message ?? "Kaydetme başarısız.");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <section className={`${SECTION_CARD_CLASS} p-4 sm:p-5`}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-[color:var(--ui-info)]" />
              <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Genel Bilgiler</h3>
            </div>
            <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
              Restoran adını ve temel işletme ayarlarını bu alandan yönetin.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] px-2.5 py-1 text-xs font-medium text-[color:var(--ui-text-secondary)]">
            Temel profil
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">Restoran adı</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <div className="flex items-end">
            <label
              className={checkboxControlClasses({
                checked: orderingDisabled,
                className: "w-full rounded-xl border-[color:var(--ui-field-border)] bg-[color:var(--ui-surface-subtle)] px-3 py-2.5",
              })}
            >
              <input
                type="checkbox"
                checked={orderingDisabled}
                onChange={(e) => setOrderingDisabled(e.target.checked)}
                className={checkboxInputClasses()}
              />
              <span className={checkboxLabelClasses("text-sm font-medium text-[color:var(--ui-text-secondary)]")}>
                Siparişe kapalı (bakım)
              </span>
            </label>
          </div>
        </div>
      </section>

      <section className={`${SECTION_CARD_CLASS} p-4 sm:p-5`}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2">
              <ImagePlus className="h-4 w-4 text-[color:var(--ui-info)]" />
              <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Marka ve Logo</h3>
            </div>
            <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
              Restoran logosunu yükleyin veya güncelleyin.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] px-2.5 py-1 text-xs font-medium text-[color:var(--ui-text-secondary)]">
            {RESTAURANT_LOGO_RECOMMENDED_SIZE_TEXT}
          </span>
        </div>

        <div className="rounded-xl border border-dashed border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] p-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => logoInputRef.current?.click()}
              disabled={isUploadingLogo || isPending}
              className={SECONDARY_BUTTON_CLASS}
            >
              {isUploadingLogo ? "Yükleniyor..." : "Logo Yükle"}
            </button>
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoFileChange}
            />

            {logoUrl ? (
              <div className="flex items-center gap-2 text-xs text-[color:var(--ui-text-secondary)]">
                <Image
                  src={logoUrl}
                  alt="Logo önizleme"
                  width={44}
                  height={44}
                  className="h-11 w-11 rounded-full border border-[color:var(--ui-border)] bg-white object-contain"
                />
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={isRemovingLogo || isUploadingLogo || isPending}
                  className={DANGER_BUTTON_CLASS}
                >
                  {isRemovingLogo ? "Siliniyor..." : "Logo Kaldır"}
                </button>
              </div>
            ) : (
              <p className="text-xs text-[color:var(--ui-text-secondary)]">Henüz logo yüklenmedi.</p>
            )}
          </div>
          <p className="mt-2 text-xs text-[color:var(--ui-text-secondary)]">Maksimum dosya boyutu: 1MB.</p>
        </div>
      </section>

      <section className={`${SECTION_CARD_CLASS} p-4 sm:p-5`}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2.5">
          <div>
            <div className="flex items-center gap-2">
              <Clock3 className="h-4 w-4 text-[color:var(--ui-info)]" />
              <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Haftalık Çalışma Saatleri</h3>
            </div>
            <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
              Gün bazlı saatleri kompakt görünümde yönetin.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] px-2.5 py-1 text-xs font-medium text-[color:var(--ui-text-secondary)]">
            Tek gün detay görünümü
          </span>
        </div>

        <div className="space-y-2.5">
          {WEEKDAY_ORDER.map((weekday) => {
            const row = workingHours.find((item) => item.weekday === weekday);
            if (!row) return null;
            const isExpanded = expandedWeekday === weekday;

            return (
              <article
                key={weekday}
                className="rounded-xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-bg)] px-3 py-2.5 shadow-none"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedWeekday((current) => (current === weekday ? null : weekday))
                  }
                  aria-expanded={isExpanded}
                  aria-controls={`working-hours-panel-${weekday}`}
                  className="flex w-full items-center justify-between gap-3 rounded-lg text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[color:var(--ui-text-primary)]">
                      {WEEKDAY_LABEL_TR[weekday]}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-[color:var(--ui-text-secondary)]">
                      {workingHourSummary(row)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={dayStatusBadgeClass(row)}
                    >
                      {row.isOpen ? "Açık" : "Kapalı"}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-[color:var(--ui-text-secondary)] transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>

                {isExpanded ? (
                  <div
                    id={`working-hours-panel-${weekday}`}
                    className="mt-3 rounded-lg border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] p-3"
                  >
                    <label
                      className={checkboxControlClasses({
                        checked: row.isOpen,
                        className: "w-fit rounded-xl border-[color:var(--ui-field-border)] bg-[color:var(--ui-surface-bg)] px-3 py-2",
                      })}
                    >
                      <input
                        type="checkbox"
                        checked={row.isOpen}
                        onChange={(e) => handleToggleDayOpen(weekday, e.target.checked)}
                        className={checkboxInputClasses()}
                      />
                      <span className={checkboxLabelClasses("text-sm font-medium text-[color:var(--ui-text-secondary)]")}>
                        Bu gün açık
                      </span>
                    </label>

                    {row.isOpen ? (
                      <div className="mt-3 space-y-3">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">
                              Başlangıç saati
                            </label>
                            <input
                              type="time"
                              value={row.openTime ?? ""}
                              onChange={(e) =>
                                updateWorkingHourRow(weekday, { openTime: e.target.value || null })
                              }
                              className={TIME_INPUT_CLASS}
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">
                              Bitiş saati
                            </label>
                            <input
                              type="time"
                              value={row.closeTime ?? ""}
                              onChange={(e) =>
                                updateWorkingHourRow(weekday, { closeTime: e.target.value || null })
                              }
                              className={TIME_INPUT_CLASS}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-[color:var(--ui-text-secondary)]">
                          İkinci vardiya ihtiyacı olursa bu gün kartı altına ek zaman dilimi alanı
                          genişletilebilir.
                        </p>
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-[color:var(--ui-text-secondary)]">
                        Bu gün kapalı seçili olduğu için saat alanları gizlendi.
                      </p>
                    )}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>

        <p className="mt-3 text-xs text-[color:var(--ui-text-secondary)]">
          Açık günlerde açılış saati kapanış saatinden küçük olmalıdır.
        </p>
      </section>

      <section className={`${SECTION_CARD_CLASS} p-4 sm:p-5`}>
        <div className="mb-4 flex items-center gap-2">
              <MapPin className="h-4 w-4 text-[color:var(--ui-info)]" />
          <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Sipariş Konum Doğrulaması</h3>
        </div>

        <label
          className={checkboxControlClasses({
            checked: locationEnforcementEnabled,
            className: "mb-3 w-full rounded-xl border-[color:var(--ui-field-border)] bg-[color:var(--ui-surface-subtle)] px-3 py-2.5",
          })}
        >
          <input
            type="checkbox"
            checked={locationEnforcementEnabled}
            onChange={(e) => setLocationEnforcementEnabled(e.target.checked)}
            className={checkboxInputClasses()}
          />
          <span className={checkboxLabelClasses("text-sm font-medium text-[color:var(--ui-text-secondary)]")}>
            Sipariş öncesi müşteri konumunu zorunlu kontrol et
          </span>
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">Enlem</label>
            <input
              type="text"
              value={locationLatitude}
              onChange={(e) => setLocationLatitude(e.target.value)}
              placeholder="41.0082000"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">Boylam</label>
            <input
              type="text"
              value={locationLongitude}
              onChange={(e) => setLocationLongitude(e.target.value)}
              placeholder="28.9784000"
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">
              Maksimum mesafe (metre)
            </label>
            <input
              type="number"
              min={MIN_ORDER_RADIUS_METERS}
              max={MAX_ORDER_RADIUS_METERS}
              value={orderRadiusMeters}
              onChange={(e) => setOrderRadiusMeters(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div className="mt-3">
          <button
            type="button"
            onClick={handleUseCurrentLocation}
            disabled={isPending || isDetectingLocation}
            className={SECONDARY_BUTTON_CLASS}
          >
            {isDetectingLocation ? "Konum alınıyor..." : "Mevcut konumumu kullan"}
          </button>
        </div>

        <p className="mt-2 text-xs text-[color:var(--ui-text-secondary)]">
          Açıksa, müşteri sadece belirtilen yarıçap içindeyse sipariş verebilir.
        </p>
      </section>

      <section className={`${SECTION_CARD_CLASS} p-4 sm:p-5`}>
        <div className="mb-4 flex items-center gap-2">
          <Palette className="h-4 w-4 text-[color:var(--ui-info)]" />
          <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Menü Tema ve Operasyon Ayarları</h3>
        </div>

        <div className="space-y-4">
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
              Mutfak bekleme uyarı eşikleri (dakika)
            </h4>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">Sarı</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={kitchenYellow}
                  onChange={(e) => setKitchenYellow(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">Turuncu</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={kitchenOrange}
                  onChange={(e) => setKitchenOrange(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">Kırmızı</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={kitchenRed}
                  onChange={(e) => setKitchenRed(e.target.value)}
                  className={INPUT_CLASS}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] p-3.5">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
              Müşteri menü tema rengi
            </h4>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setThemeColor("primary")}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                  themeColor === "primary"
                    ? "border-orange-500 bg-orange-50 text-neutral-900"
                    : "border-neutral-200 bg-white text-neutral-700"
                }`}
              >
                <span className="h-5 w-5 rounded-full bg-orange-500" />
                <span>Koyu turuncu tema</span>
              </button>
              <button
                type="button"
                onClick={() => setThemeColor("secondary")}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
                  themeColor === "secondary"
                    ? "border-emerald-500 bg-emerald-50 text-neutral-900"
                    : "border-neutral-200 bg-white text-neutral-700"
                }`}
              >
                <span className="h-5 w-5 rounded-full bg-emerald-500" />
                <span>Yeşil ağırlıklı tema</span>
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">Yazı boyutu (px)</label>
              <input
                type="number"
                min={MIN_MENU_FONT_SIZE_PX}
                max={MAX_MENU_FONT_SIZE_PX}
                value={menuFontSizePx}
                onChange={(e) => setMenuFontSizePx(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">Yazı rengi</label>
              <input
                type="color"
                value={menuTextColor}
                onChange={(e) => setMenuTextColor(e.target.value.toUpperCase())}
                className="h-10 w-full rounded-xl border border-[color:var(--ui-field-border)] bg-[color:var(--ui-surface-bg)] px-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">Arka plan rengi</label>
              <input
                type="color"
                value={menuBackgroundColor}
                onChange={(e) => setMenuBackgroundColor(e.target.value.toUpperCase())}
                className="h-10 w-full rounded-xl border border-[color:var(--ui-field-border)] bg-[color:var(--ui-surface-bg)] px-2"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">
                Buton arka plan rengi
              </label>
              <input
                type="color"
                value={menuButtonBackgroundColor}
                onChange={(e) => setMenuButtonBackgroundColor(e.target.value.toUpperCase())}
                className="h-10 w-full rounded-xl border border-[color:var(--ui-field-border)] bg-[color:var(--ui-surface-bg)] px-2"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">
                Header arka plan rengi
              </label>
              <input
                type="color"
                value={menuHeaderBackgroundColor}
                onChange={(e) => setMenuHeaderBackgroundColor(e.target.value.toUpperCase())}
                className="h-10 w-full rounded-xl border border-[color:var(--ui-field-border)] bg-[color:var(--ui-surface-bg)] px-2"
              />
            </div>
          </div>
        </div>
      </section>

      <div className="sticky bottom-4 z-20">
        <div className="rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-elevated)] px-3 py-3 shadow-none sm:px-4">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="min-w-0 flex-1 text-xs text-[color:var(--ui-text-secondary)]">
              Değişiklikleri uygulamak için ayarları kaydedin.
            </p>
            <button
              type="submit"
              disabled={isPending}
              className={`${PRIMARY_BUTTON_CLASS} w-full shrink-0 sm:w-auto`}
            >
              {isPending ? "Kaydediliyor..." : "Ayarları Kaydet"}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

