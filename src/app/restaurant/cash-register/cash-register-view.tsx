"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { CashMovementCategory, CashMovementType } from "@prisma/client";
import { AlertCircle, ArrowDownCircle, ArrowUpCircle, Clock3, Trash2, Wallet } from "lucide-react";
import toast from "react-hot-toast";
import {
  closeCashRegisterDay,
  createCashMovement,
  voidCashMovement,
} from "@/app/actions/cash-register";
import {
  badgeClasses,
  buttonClasses,
  cardClasses,
  fieldClasses,
  labelClasses,
  textareaClasses,
} from "@/lib/ui/button-variants";

type RestaurantOption = {
  id: number;
  name: string;
};

type MovementRow = {
  id: number;
  occurredAt: string;
  type: CashMovementType;
  category: CashMovementCategory;
  note: string | null;
  amount: number;
  isVoided: boolean;
  actorDisplayName: string | null;
  actorUsername: string | null;
};

type Summary = {
  businessDate: string;
  openingBalance: number;
  totalIn: number;
  totalOut: number;
  currentBalance: number;
  lastMovementAt: string | null;
  dayClosedAt: string | null;
  countedBalance: number | null;
  variance: number | null;
  closingNote: string | null;
};

type CashRegisterViewProps = {
  restaurants: RestaurantOption[];
  selectedRestaurantId: number;
  businessDate: string;
  categoryOptions: ReadonlyArray<{ value: CashMovementCategory; label: string }>;
  summary: Summary;
  movements: MovementRow[];
};

const INPUT_CLASS = fieldClasses({ size: "md" });

function formatCurrency(value: number) {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default function CashRegisterView({
  restaurants,
  selectedRestaurantId,
  businessDate,
  categoryOptions,
  summary,
  movements,
}: CashRegisterViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const [movementType, setMovementType] = useState<CashMovementType>("IN");
  const [movementCategory, setMovementCategory] = useState<CashMovementCategory>(
    categoryOptions[0]?.value ?? "OTHER",
  );
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [countedBalance, setCountedBalance] = useState(
    summary.countedBalance != null ? String(summary.countedBalance) : "",
  );
  const [closingNote, setClosingNote] = useState(summary.closingNote ?? "");

  const categoryLabelMap = useMemo(
    () => new Map(categoryOptions.map((option) => [option.value, option.label])),
    [categoryOptions],
  );

  const dayClosed = Boolean(summary.dayClosedAt);

  const navigateWithRestaurant = (nextRestaurantId: number) => {
    const next = new URLSearchParams();
    next.set("restaurantId", String(nextRestaurantId));
    router.push(`${pathname}?${next.toString()}`);
  };

  const handleCreateMovement = (event: React.FormEvent) => {
    event.preventDefault();
    if (!amount.trim()) {
      toast.error("Tutar gerekli.");
      return;
    }

    startTransition(async () => {
      const result = await createCashMovement({
        restaurantId: selectedRestaurantId,
        type: movementType,
        category: movementCategory,
        amount,
        note,
        businessDate,
      });
      if (!result.success) {
        toast.error(result.message ?? "İşlem kaydedilemedi.");
        return;
      }

      toast.success("Kasa işlemi kaydedildi.");
      setAmount("");
      setNote("");
      router.refresh();
    });
  };

  const handleVoidMovement = (movementId: number) => {
    if (!confirm("Bu işlemi iptal etmek istiyor musunuz?")) return;

    startTransition(async () => {
      const result = await voidCashMovement({
        movementId,
        restaurantId: selectedRestaurantId,
        businessDate,
      });
      if (!result.success) {
        toast.error(result.message ?? "İşlem iptal edilemedi.");
        return;
      }
      toast.success("İşlem iptal edildi.");
      router.refresh();
    });
  };

  const handleCloseDay = (event: React.FormEvent) => {
    event.preventDefault();
    if (!countedBalance.trim()) {
      toast.error("Sayılan fiziksel kasa tutarı gerekli.");
      return;
    }

    startTransition(async () => {
      const result = await closeCashRegisterDay({
        restaurantId: selectedRestaurantId,
        countedBalance,
        closingNote,
        businessDate,
      });
      if (!result.success) {
        toast.error(result.message ?? "Gün sonu kaydedilemedi.");
        return;
      }
      toast.success("Gün sonu kaydedildi.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-4 sm:p-5" })}>
        <div className="grid gap-3 sm:grid-cols-[minmax(220px,1fr)_auto] sm:items-end">
          <label className="block">
            <span className={labelClasses("mb-1 block text-xs uppercase tracking-wide")}>
              Restoran
            </span>
            <select
              value={selectedRestaurantId}
              onChange={(event) => navigateWithRestaurant(Number(event.target.value))}
              className={INPUT_CLASS}
            >
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </select>
          </label>
          <div className="inline-flex h-10 items-center rounded-xl border border-[color:var(--ui-border)] bg-[color:var(--ui-bg-subtle)] px-3 text-xs font-medium text-[color:var(--ui-text-secondary)]">
            İşlem tarihi: {new Date(`${businessDate}T00:00:00`).toLocaleDateString("tr-TR")}
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className={cardClasses({ className: "p-3.5" })}>
          <p className="text-[11px] uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
            Açılış bakiyesi
          </p>
          <p className="mt-1.5 text-lg font-semibold text-[color:var(--ui-text-primary)]">
            {formatCurrency(summary.openingBalance)}
          </p>
        </article>

        <article className={cardClasses({ tone: "success", className: "p-3.5" })}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                Toplam nakit giriş
              </p>
              <p className="mt-1.5 text-lg font-semibold text-[color:var(--ui-text-primary)]">
                {formatCurrency(summary.totalIn)}
              </p>
            </div>
            <ArrowUpCircle className="h-5 w-5 text-[color:var(--ui-success)]" />
          </div>
        </article>

        <article className={cardClasses({ tone: "warning", className: "p-3.5" })}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                Toplam nakit çıkış
              </p>
              <p className="mt-1.5 text-lg font-semibold text-[color:var(--ui-text-primary)]">
                {formatCurrency(summary.totalOut)}
              </p>
            </div>
            <ArrowDownCircle className="h-5 w-5 text-[color:var(--ui-warning)]" />
          </div>
        </article>

        <article className={cardClasses({ className: "p-3.5" })}>
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                Anlık kasa bakiyesi
              </p>
              <p className="mt-1.5 text-lg font-semibold text-[color:var(--ui-text-primary)]">
                {formatCurrency(summary.currentBalance)}
              </p>
            </div>
            <Wallet className="h-5 w-5 text-[color:var(--ui-primary)]" />
          </div>
          <p className="mt-2 inline-flex items-center gap-1 text-xs text-[color:var(--ui-text-secondary)]">
            <Clock3 className="h-3.5 w-3.5" />
            Son işlem: {formatDateTime(summary.lastMovementAt)}
          </p>
        </article>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(320px,380px)_1fr]">
        <div className="space-y-4">
          <section className={cardClasses({ className: "p-4 sm:p-5" })}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">
                  Hızlı işlem
                </h3>
                <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
                  Nakit giriş veya çıkış işlemini tek adımda kaydedin.
                </p>
              </div>
              {dayClosed ? (
                <span className={badgeClasses("warning")}>Gün kapandı</span>
              ) : (
                <span className={badgeClasses("neutral")}>Açık</span>
              )}
            </div>

            <form onSubmit={handleCreateMovement} className="mt-4 space-y-3">
              <label className="block">
                <span className={labelClasses("mb-1 block text-xs")}>İşlem tipi</span>
                <select
                  value={movementType}
                  onChange={(event) => setMovementType(event.target.value as CashMovementType)}
                  className={INPUT_CLASS}
                  disabled={dayClosed || isPending}
                >
                  <option value="IN">Nakit Giriş</option>
                  <option value="OUT">Nakit Çıkış</option>
                </select>
              </label>

              <label className="block">
                <span className={labelClasses("mb-1 block text-xs")}>Tutar</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  inputMode="decimal"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  className={INPUT_CLASS}
                  placeholder="0.00"
                  disabled={dayClosed || isPending}
                />
              </label>

              <label className="block">
                <span className={labelClasses("mb-1 block text-xs")}>Kategori</span>
                <select
                  value={movementCategory}
                  onChange={(event) =>
                    setMovementCategory(event.target.value as CashMovementCategory)
                  }
                  className={INPUT_CLASS}
                  disabled={dayClosed || isPending}
                >
                  {categoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className={labelClasses("mb-1 block text-xs")}>Açıklama / not</span>
                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className={textareaClasses({ size: "md", className: "min-h-[88px]" })}
                  maxLength={500}
                  placeholder="Opsiyonel not"
                  disabled={dayClosed || isPending}
                />
              </label>

              <button
                type="submit"
                disabled={dayClosed || isPending}
                className={buttonClasses({
                  variant: movementType === "IN" ? "success" : "warning",
                  size: "md",
                  className: "h-10 w-full",
                })}
              >
                İşlemi kaydet
              </button>
            </form>
          </section>

          <section className={cardClasses({ className: "p-4 sm:p-5" })}>
            <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Gün sonu</h3>
            <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
              Fiziksel kasayı sayıp sistem bakiyesi ile farkı kaydedin.
            </p>

            <div className="mt-3 space-y-1.5 rounded-xl border border-[color:var(--ui-border)] bg-[color:var(--ui-bg-subtle)] p-3">
              <p className="text-xs text-[color:var(--ui-text-secondary)]">Sistem bakiyesi</p>
              <p className="text-lg font-semibold text-[color:var(--ui-text-primary)]">
                {formatCurrency(summary.currentBalance)}
              </p>
              {summary.variance != null ? (
                <p className="text-xs text-[color:var(--ui-text-secondary)]">
                  Kayıtlı fark: {formatCurrency(summary.variance)}
                </p>
              ) : null}
            </div>

            <form onSubmit={handleCloseDay} className="mt-4 space-y-3">
              <label className="block">
                <span className={labelClasses("mb-1 block text-xs")}>Sayılan fiziksel kasa</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  inputMode="decimal"
                  value={countedBalance}
                  onChange={(event) => setCountedBalance(event.target.value)}
                  className={INPUT_CLASS}
                  placeholder="0.00"
                  disabled={dayClosed || isPending}
                />
              </label>

              <label className="block">
                <span className={labelClasses("mb-1 block text-xs")}>Gün sonu notu</span>
                <textarea
                  value={closingNote}
                  onChange={(event) => setClosingNote(event.target.value)}
                  className={textareaClasses({ size: "md", className: "min-h-[88px]" })}
                  maxLength={1000}
                  placeholder="Opsiyonel açıklama"
                  disabled={dayClosed || isPending}
                />
              </label>

              <button
                type="submit"
                disabled={dayClosed || isPending}
                className={buttonClasses({
                  variant: "primary",
                  size: "md",
                  className: "h-10 w-full",
                })}
              >
                Gün sonunu kaydet
              </button>
            </form>

            {summary.dayClosedAt ? (
              <p className="mt-3 inline-flex items-center gap-1 text-xs text-[color:var(--ui-text-secondary)]">
                <AlertCircle className="h-3.5 w-3.5" />
                Kapanış zamanı: {formatDateTime(summary.dayClosedAt)}
              </p>
            ) : null}
          </section>
        </div>

        <section className={cardClasses({ className: "overflow-hidden p-0" })}>
          <div className="flex items-center justify-between border-b border-[color:var(--ui-border)] px-4 py-3 sm:px-5">
            <div>
              <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">
                Bugünün hareketleri
              </h3>
              <p className="mt-0.5 text-xs text-[color:var(--ui-text-secondary)]">
                Void edilen kayıtlar rapor hesaplamasına dahil edilmez.
              </p>
            </div>
            <span className={badgeClasses("neutral")}>{movements.length} kayıt</span>
          </div>

          {movements.length === 0 ? (
            <div className="px-4 py-8 text-sm text-[color:var(--ui-text-secondary)]">
              Bugün için hareket bulunmuyor.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[color:var(--ui-border)] text-sm">
                <thead className="bg-[color:var(--ui-bg-subtle)] text-xs uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Saat</th>
                    <th className="px-4 py-2 text-left font-semibold">Tip</th>
                    <th className="px-4 py-2 text-left font-semibold">Kategori</th>
                    <th className="px-4 py-2 text-left font-semibold">Açıklama</th>
                    <th className="px-4 py-2 text-right font-semibold">Tutar</th>
                    <th className="px-4 py-2 text-left font-semibold">Kullanıcı</th>
                    <th className="px-4 py-2 text-right font-semibold">Aksiyon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--ui-border)]">
                  {movements.map((movement) => {
                    const amountClass = movement.isVoided
                      ? "text-[color:var(--ui-text-secondary)]"
                      : movement.type === "IN"
                        ? "text-[color:var(--ui-success)]"
                        : "text-[color:var(--ui-danger)]";
                    const amountPrefix = movement.type === "IN" ? "+" : "-";
                    const actor = movement.actorDisplayName ?? movement.actorUsername ?? "-";

                    return (
                      <tr
                        key={movement.id}
                        className={movement.isVoided ? "bg-[color:var(--ui-bg-subtle)]/40" : ""}
                      >
                        <td className="px-4 py-2.5 text-[color:var(--ui-text-primary)]">
                          {new Date(movement.occurredAt).toLocaleTimeString("tr-TR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={badgeClasses(movement.type === "IN" ? "success" : "warning")}>
                            {movement.type === "IN" ? "Nakit giriş" : "Nakit çıkış"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[color:var(--ui-text-primary)]">
                          {categoryLabelMap.get(movement.category) ?? movement.category}
                        </td>
                        <td className="px-4 py-2.5 text-[color:var(--ui-text-secondary)]">
                          {movement.note ?? "-"}
                          {movement.isVoided ? (
                            <span className="ml-2 inline-flex items-center gap-1 text-xs text-[color:var(--ui-danger)]">
                              <AlertCircle className="h-3.5 w-3.5" />
                              İptal edildi
                            </span>
                          ) : null}
                        </td>
                        <td className={`px-4 py-2.5 text-right font-semibold ${amountClass}`}>
                          {amountPrefix}
                          {formatCurrency(movement.amount)}
                        </td>
                        <td className="px-4 py-2.5 text-[color:var(--ui-text-primary)]">{actor}</td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleVoidMovement(movement.id)}
                            disabled={isPending || dayClosed || movement.isVoided}
                            className={buttonClasses({
                              variant: "danger",
                              size: "xs",
                              className: "px-2.5",
                            })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Void
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}


