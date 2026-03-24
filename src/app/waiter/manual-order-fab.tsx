"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import toast from "react-hot-toast";
import { createOrderManual } from "@/app/actions/create-order-manual";

type Table = { id: number; tableNo: number; isActive: boolean };
type Product = { id: number; nameTR: string; price: number; categoryId: number };
type Category = { id: number; nameTR: string };

export default function ManualOrderFab({
  tables,
  products,
  categories,
  openWithTableId = null,
  onOpenWithTableIdCleared,
}: {
  tables: Table[];
  products: Product[];
  categories: Category[];
  openWithTableId?: number | null;
  onOpenWithTableIdCleared?: () => void;
}) {
  const router = useRouter();
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedTableId, setSelectedTableId] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [cart, setCart] = useState<{ productId: number; nameTR: string; price: number; quantity: number }[]>([]);

  const activeTables = tables.filter((t) => t.isActive);
  const productsByCategory = categories.map((cat) => ({
    ...cat,
    products: products.filter((p) => p.categoryId === cat.id),
  }));

  const addToCart = (p: Product) => {
    setCart((prev) => {
      const existing = prev.find((x) => x.productId === p.id);
      if (existing) {
        return prev.map((x) =>
          x.productId === p.id ? { ...x, quantity: x.quantity + 1 } : x,
        );
      }
      return [...prev, { productId: p.id, nameTR: p.nameTR, price: p.price, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((x) => x.productId !== productId));
  };

  const changeQty = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((x) =>
          x.productId === productId
            ? { ...x, quantity: Math.max(0, x.quantity + delta) }
            : x,
        )
        .filter((x) => x.quantity > 0),
    );
  };

  const total = cart.reduce((s, x) => s + x.price * x.quantity, 0);

  const isExternallyOpened = openWithTableId != null;
  const open = isManualOpen || isExternallyOpened;
  const effectiveTableId = selectedTableId ?? openWithTableId ?? 0;

  const handleClose = () => {
    if (isExternallyOpened) {
      onOpenWithTableIdCleared?.();
    } else {
      setIsManualOpen(false);
    }
  };

  const handleSubmit = () => {
    const tid = effectiveTableId || activeTables[0]?.id;
    if (!tid) {
      toast.error("Masa seçin.");
      return;
    }
    if (cart.length === 0) {
      toast.error("En az bir ürün ekleyin.");
      return;
    }
    startTransition(async () => {
      const result = await createOrderManual(
        tid,
        cart.map((x) => ({ productId: x.productId, quantity: x.quantity, price: x.price })),
        note.trim() || undefined,
      );
      if (result.success) {
        toast.success(result.message);
        handleClose();
        setCart([]);
        setNote("");
        router.refresh();
      } else {
        toast.error(result.message ?? "Bir hata oluştu");
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setIsManualOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[color:var(--ui-primary)] text-white shadow-lg hover:bg-[color:var(--ui-primary-hover)]"
        aria-label="Manuel sipariş"
      >
        <Plus className="h-6 w-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-elevated)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[color:var(--ui-border)] p-4">
              <h2 className="text-lg font-semibold">Manuel Sipariş</h2>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg p-1 text-neutral-500 hover:bg-neutral-100"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-4">
                <label className="mb-1 block text-sm font-medium">Masa</label>
                <select
                  value={effectiveTableId || ""}
                  onChange={(e) => setSelectedTableId(Number(e.target.value) || null)}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                >
                  <option value="">Seçin</option>
                  {activeTables.map((t) => (
                    <option key={t.id} value={t.id}>
                      Masa {t.tableNo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium">Ürünler</label>
                <div className="space-y-2">
                  {productsByCategory.map((cat) =>
                    cat.products.length > 0 ? (
                      <div key={cat.id}>
                        <p className="text-xs font-semibold text-neutral-500">
                          {cat.nameTR}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {cat.products.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => addToCart(p)}
                              className="rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs hover:bg-neutral-50"
                            >
                              {p.nameTR} ({p.price.toFixed(2)} ₺)
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null,
                  )}
                </div>
              </div>

              {cart.length > 0 && (
                <div className="mb-4 rounded-xl border border-neutral-200 p-3">
                  <p className="mb-2 text-xs font-semibold text-neutral-600">
                    Sepet
                  </p>
                  <ul className="space-y-1 text-sm">
                    {cart.map((x) => (
                      <li
                        key={x.productId}
                        className="flex items-center justify-between"
                      >
                        <span>
                          {x.quantity}x {x.nameTR}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => changeQty(x.productId, -1)}
                            className="rounded border px-1.5 py-0.5 text-xs"
                          >
                            -
                          </button>
                          <span>{x.quantity}</span>
                          <button
                            type="button"
                            onClick={() => changeQty(x.productId, 1)}
                            className="rounded border px-1.5 py-0.5 text-xs"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => removeFromCart(x.productId)}
                    className="text-red-600 text-xs"
                          >
                            Sil
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 font-semibold">
                    Toplam: {total.toFixed(2)} ₺
                  </p>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium">Not</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Opsiyonel"
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-[color:var(--ui-border)] p-4">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl border px-4 py-2 text-sm font-medium"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isPending || cart.length === 0}
                className="rounded-xl bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {isPending ? "Gönderiliyor..." : "Siparişi Gönder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
