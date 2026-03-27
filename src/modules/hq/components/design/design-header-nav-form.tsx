"use client";

import { useActionState, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { saveLandingDesignHeaderAction } from "@/modules/hq/actions/landing-design";
import type { LandingPublicCta, LandingPublicNavItem } from "@/modules/marketing/landing-public-design";
import { inferLinkType } from "@/modules/marketing/landing-public-design";
import { buttonClasses } from "@/lib/ui/button-variants";
import { fieldClasses, labelClasses } from "@/lib/ui/button-variants";
import { DesignSaveFeedback } from "@/modules/hq/components/design/design-save-feedback";

type Props = {
  initialNav: LandingPublicNavItem[];
  initialHeaderCta: LandingPublicCta;
};

function newItem(): LandingPublicNavItem {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `nav-${Date.now()}`,
    label: "Yeni öğe",
    href: "#",
    sortOrder: 0,
    isActive: true,
    linkType: "internal",
  };
}

export function DesignHeaderNavForm({ initialNav, initialHeaderCta }: Props) {
  const [state, formAction, pending] = useActionState(saveLandingDesignHeaderAction, undefined);
  const [items, setItems] = useState<LandingPublicNavItem[]>(() => [...initialNav]);
  const [header, setHeader] = useState(initialHeaderCta);

  function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= items.length) return;
    setItems((prev) => {
      const copy = [...prev];
      const t = copy[index]!;
      copy[index] = copy[next]!;
      copy[next] = t;
      return copy.map((row, i) => ({ ...row, sortOrder: i + 1 }));
    });
  }

  function update(index: number, patch: Partial<LandingPublicNavItem>) {
    setItems((prev) => {
      const copy = [...prev];
      const row = { ...copy[index]!, ...patch };
      if (patch.href !== undefined) {
        row.linkType = inferLinkType(row.href);
      }
      copy[index] = row;
      return copy;
    });
  }

  function remove(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function add() {
    setItems((prev) => [...prev, { ...newItem(), sortOrder: prev.length + 1 }]);
  }

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("navPayload", JSON.stringify(items));
        void formAction(fd);
      }}
    >
      <DesignSaveFeedback state={state} />

      <div className="space-y-3 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-bg)] p-4">
        <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Üst çubuk CTA</h3>
        <p className="text-xs text-[var(--ui-text-muted)]">
          Sağ üstteki ana buton. Kapatırsanız üst çubukta bu düğme gösterilmez.
        </p>
        <input type="hidden" name="headerBarEnabled" value={header.enabled ? "true" : "false"} />
        <label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={header.enabled}
            onChange={(e) => setHeader((h) => ({ ...h, enabled: e.target.checked }))}
            className="h-4 w-4 rounded"
          />
          Üst çubukta göster
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className={labelClasses()} htmlFor="headerBarLabel">
              Buton metni
            </label>
            <input
              id="headerBarLabel"
              name="headerBarLabel"
              value={header.label}
              onChange={(e) => setHeader((h) => ({ ...h, label: e.target.value }))}
              className={fieldClasses({ className: "w-full" })}
              required
            />
          </div>
          <div className="space-y-1">
            <label className={labelClasses()} htmlFor="headerBarHref">
              Bağlantı
            </label>
            <input
              id="headerBarHref"
              name="headerBarHref"
              value={header.href}
              onChange={(e) => setHeader((h) => ({ ...h, href: e.target.value }))}
              className={fieldClasses({ className: "w-full font-mono text-sm" })}
              required
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Gezinme öğeleri</h3>
          <button
            type="button"
            onClick={add}
            className={buttonClasses({
              variant: "outline",
              className: "inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm",
            })}
          >
            <Plus className="h-4 w-4" />
            Öğe ekle
          </button>
        </div>
        <p className="text-xs text-[var(--ui-text-muted)]">
          Dahili: <code className="rounded bg-[var(--ui-surface-subtle)] px-1">#bölüm</code> veya{" "}
          <code className="rounded bg-[var(--ui-surface-subtle)] px-1">/yol</code> · Harici:{" "}
          <code className="rounded bg-[var(--ui-surface-subtle)] px-1">https://</code>
        </p>

        <ul className="space-y-3">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-bg)] p-3"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium text-[var(--ui-text-muted)]">#{index + 1}</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className="rounded-lg p-2 text-[var(--ui-text-secondary)] hover:bg-[var(--ui-surface-subtle)]"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="Yukarı taşı"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-[var(--ui-text-secondary)] hover:bg-[var(--ui-surface-subtle)]"
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                    aria-label="Aşağı taşı"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-2 text-[var(--ui-danger)] hover:bg-[var(--ui-danger-soft)]"
                    onClick={() => remove(index)}
                    aria-label="Sil"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className={labelClasses()}>Görünen metin</label>
                  <input
                    className={fieldClasses({ className: "w-full" })}
                    value={item.label}
                    onChange={(e) => update(index, { label: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className={labelClasses()}>Bağlantı</label>
                  <input
                    className={fieldClasses({ className: "w-full font-mono text-sm" })}
                    value={item.href}
                    onChange={(e) => update(index, { href: e.target.value })}
                  />
                </div>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    checked={item.isActive}
                    onChange={(e) => update(index, { isActive: e.target.checked })}
                    className="h-4 w-4 rounded"
                  />
                  Yayında göster
                </label>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <button
        type="submit"
        disabled={pending}
        className={buttonClasses({ variant: "primary", className: "rounded-lg px-5" })}
      >
        {pending ? "Kaydediliyor…" : "Kaydet"}
      </button>
    </form>
  );
}
