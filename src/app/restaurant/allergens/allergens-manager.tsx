"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
  createTenantAllergen,
  deleteTenantAllergen,
  updateTenantAllergen,
} from "@/app/actions/tenant-allergens";
import {
  badgeClasses,
  buttonClasses,
  cardClasses,
  fieldClasses,
  labelClasses,
} from "@/lib/ui/button-variants";

type TenantAllergenListItem = {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
  updatedAt: string;
};

type AllergensManagerProps = {
  allergens: TenantAllergenListItem[];
};

const INPUT_CLASS = fieldClasses({ size: "md" });

type RowDraft = {
  name: string;
  sortOrder: string;
  isActive: boolean;
};

function buildDraftMap(items: TenantAllergenListItem[]) {
  return Object.fromEntries(
    items.map((item) => [
      item.id,
      {
        name: item.name,
        sortOrder: String(item.sortOrder),
        isActive: item.isActive,
      } satisfies RowDraft,
    ]),
  ) as Record<number, RowDraft>;
}

export default function AllergensManager({ allergens }: AllergensManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [newSortOrder, setNewSortOrder] = useState("0");
  const [drafts, setDrafts] = useState<Record<number, RowDraft>>(() =>
    buildDraftMap(allergens),
  );

  useEffect(() => {
    setDrafts(buildDraftMap(allergens));
  }, [allergens]);

  const handleCreate = (event: React.FormEvent) => {
    event.preventDefault();
    const normalizedName = newName.trim();
    if (!normalizedName) {
      toast.error("Alerjen adı gerekli.");
      return;
    }

    startTransition(async () => {
      const result = await createTenantAllergen({
        name: normalizedName,
        sortOrder: Number(newSortOrder),
      });

      if (!result.success) {
        toast.error(result.message ?? "Alerjen eklenemedi.");
        return;
      }

      toast.success("Alerjen eklendi.");
      setNewName("");
      setNewSortOrder("0");
      router.refresh();
    });
  };

  const handleRowSave = (allergenId: number) => {
    const draft = drafts[allergenId];
    if (!draft) return;

    startTransition(async () => {
      const result = await updateTenantAllergen(allergenId, {
        name: draft.name,
        sortOrder: Number(draft.sortOrder),
        isActive: draft.isActive,
      });

      if (!result.success) {
        toast.error(result.message ?? "Alerjen guncellenemedi.");
        return;
      }

      toast.success("Alerjen guncellendi.");
      router.refresh();
    });
  };

  const handleDelete = (allergenId: number, allergenName: string) => {
    if (!confirm(`"${allergenName}" alerjenini silmek istiyor musunuz?`)) return;

    startTransition(async () => {
      const result = await deleteTenantAllergen(allergenId);
      if (!result.success) {
        toast.error(result.message ?? "Alerjen silinemedi.");
        return;
      }
      toast.success("Alerjen silindi.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-4 sm:p-5" })}>
        <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Yeni alerjen ekle</h3>
        <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
          Bu alerjenler, urun duzenleme ekraninda Icerik & Uyarilar bolumunde secilebilir.
        </p>

        <form onSubmit={handleCreate} className="mt-4 grid gap-2.5 sm:grid-cols-[1fr_120px_auto]">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            placeholder="Ornek: Cilek, Cikolata, Kivi"
            className={INPUT_CLASS}
            maxLength={80}
            required
          />
          <input
            type="number"
            min="0"
            step="1"
            value={newSortOrder}
            onChange={(event) => setNewSortOrder(event.target.value)}
            className={INPUT_CLASS}
            aria-label="Sira numarasi"
          />
          <button
            type="submit"
            disabled={isPending}
            className={buttonClasses({ variant: "primary", size: "md", className: "h-10 px-4" })}
          >
            Ekle
          </button>
        </form>
      </section>

      <section className={cardClasses({ className: "overflow-hidden p-0" })}>
        <div className="border-b border-[color:var(--ui-border)] px-4 py-3">
          <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Kayitli alerjenler</h3>
        </div>

        {allergens.length === 0 ? (
          <div className="px-4 py-6 text-sm text-[color:var(--ui-text-secondary)]">
            Henuz alerjen eklenmedi.
          </div>
        ) : (
          <div className="divide-y divide-[color:var(--ui-border)]">
            {allergens.map((item) => {
              const draft = drafts[item.id] ?? {
                name: item.name,
                sortOrder: String(item.sortOrder),
                isActive: item.isActive,
              };

              return (
                <article key={item.id} className="space-y-2.5 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={badgeClasses(item.isActive ? "success" : "neutral")}>
                        {item.isActive ? "Aktif" : "Pasif"}
                      </span>
                      <p className="text-xs text-[color:var(--ui-text-secondary)]">
                        Son guncelleme: {new Date(item.updatedAt).toLocaleString("tr-TR")}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleDelete(item.id, item.name)}
                      className={buttonClasses({
                        variant: "danger",
                        size: "xs",
                        className: "px-2.5",
                      })}
                    >
                      Sil
                    </button>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-[1fr_120px_auto] sm:items-end">
                    <div>
                      <label className={labelClasses("mb-1 block text-xs")}>Alerjen adi</label>
                      <input
                        value={draft.name}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.id]: { ...draft, name: event.target.value },
                          }))
                        }
                        className={INPUT_CLASS}
                        maxLength={80}
                      />
                    </div>
                    <div>
                      <label className={labelClasses("mb-1 block text-xs")}>Sira</label>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={draft.sortOrder}
                        onChange={(event) =>
                          setDrafts((prev) => ({
                            ...prev,
                            [item.id]: { ...draft, sortOrder: event.target.value },
                          }))
                        }
                        className={INPUT_CLASS}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setDrafts((prev) => ({
                          ...prev,
                          [item.id]: { ...draft, isActive: !draft.isActive },
                        }))
                      }
                      className={buttonClasses({
                        variant: draft.isActive ? "secondary" : "outline",
                        size: "md",
                        className: "h-10 px-3",
                      })}
                    >
                      {draft.isActive ? "Aktif" : "Pasif"}
                    </button>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleRowSave(item.id)}
                      className={buttonClasses({
                        variant: "success",
                        size: "sm",
                        className: "px-3",
                      })}
                    >
                      Kaydet
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
