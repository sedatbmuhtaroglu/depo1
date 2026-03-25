"use client";

import { useActionState, useMemo, useState } from "react";
import {
  buttonClasses,
  checkboxInputClasses,
  fieldClasses,
  labelClasses,
} from "@/lib/ui/button-variants";
import {
  DEFAULT_LANDING_THEME,
  LANDING_SECTION_SPECS,
  type LandingBadgeItem,
  type LandingCardItem,
  type LandingFormTexts,
  type LandingNavigationChildItem,
  type LandingNavigationItem,
  type LandingSectionConfig,
  type LandingStatItem,
  type LandingThemeTokens,
} from "@/modules/marketing/landing-cms-schema";
import { saveMarketingLandingBuilderAction } from "@/modules/hq/actions/marketing";
import { CmsRichTextEditor } from "@/modules/hq/components/cms-rich-text-editor";
import type { MarketingLandingHqData } from "@/modules/marketing/server/landing-content";

type MarketingLandingBuilderFormProps = {
  site: MarketingLandingHqData;
};

type FormState = {
  ok: boolean;
  message: string;
};

const INITIAL_STATE: FormState = {
  ok: false,
  message: "",
};

type RichListEditorProps = {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  addLabel: string;
};

function RichListEditor({ label, values, onChange, addLabel }: RichListEditorProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--ui-text-primary)]">{label}</p>
        <button
          type="button"
          className={buttonClasses({ variant: "outline", size: "xs" })}
          onClick={() => onChange([...values, ""])}
        >
          {addLabel}
        </button>
      </div>
      <div className="space-y-3">
        {values.map((item, index) => (
          <div key={`${label}-${index}`} className="rounded-xl border border-[var(--ui-border-subtle)] p-2">
            <CmsRichTextEditor
              label={`${label} #${index + 1}`}
              value={item}
              onChange={(next) => {
                const cloned = [...values];
                cloned[index] = next;
                onChange(cloned);
              }}
              minHeightClassName="min-h-[72px]"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className={buttonClasses({ variant: "ghost", size: "xs" })}
                onClick={() => onChange(values.filter((_, idx) => idx !== index))}
              >
                Kaldir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BadgeListEditor({
  badges,
  onChange,
}: {
  badges: LandingBadgeItem[];
  onChange: (items: LandingBadgeItem[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--ui-text-primary)]">Rozetler</p>
        <button
          type="button"
          className={buttonClasses({ variant: "outline", size: "xs" })}
          onClick={() => onChange([...badges, { label: "", sublabel: "" }])}
        >
          Rozet Ekle
        </button>
      </div>
      <div className="space-y-3">
        {badges.map((item, index) => (
          <div key={`badge-${index}`} className="rounded-xl border border-[var(--ui-border-subtle)] p-2">
            <CmsRichTextEditor
              label={`Rozet Basligi #${index + 1}`}
              value={item.label}
              onChange={(next) => {
                const cloned = [...badges];
                cloned[index] = { ...cloned[index], label: next };
                onChange(cloned);
              }}
              minHeightClassName="min-h-[64px]"
            />
            <CmsRichTextEditor
              label={`Rozet Aciklamasi #${index + 1}`}
              value={item.sublabel ?? ""}
              onChange={(next) => {
                const cloned = [...badges];
                cloned[index] = { ...cloned[index], sublabel: next };
                onChange(cloned);
              }}
              minHeightClassName="min-h-[64px]"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className={buttonClasses({ variant: "ghost", size: "xs" })}
                onClick={() => onChange(badges.filter((_, idx) => idx !== index))}
              >
                Kaldir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatsListEditor({
  stats,
  onChange,
}: {
  stats: LandingStatItem[];
  onChange: (items: LandingStatItem[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--ui-text-primary)]">Istatistikler</p>
        <button
          type="button"
          className={buttonClasses({ variant: "outline", size: "xs" })}
          onClick={() => onChange([...stats, { label: "", value: "", sublabel: "" }])}
        >
          Istatistik Ekle
        </button>
      </div>
      <div className="space-y-3">
        {stats.map((item, index) => (
          <div key={`stat-${index}`} className="rounded-xl border border-[var(--ui-border-subtle)] p-2">
            <CmsRichTextEditor
              label={`Etiket #${index + 1}`}
              value={item.label}
              onChange={(next) => {
                const cloned = [...stats];
                cloned[index] = { ...cloned[index], label: next };
                onChange(cloned);
              }}
              minHeightClassName="min-h-[60px]"
            />
            <CmsRichTextEditor
              label={`Deger #${index + 1}`}
              value={item.value}
              onChange={(next) => {
                const cloned = [...stats];
                cloned[index] = { ...cloned[index], value: next };
                onChange(cloned);
              }}
              minHeightClassName="min-h-[60px]"
            />
            <CmsRichTextEditor
              label={`Alt Aciklama #${index + 1}`}
              value={item.sublabel ?? ""}
              onChange={(next) => {
                const cloned = [...stats];
                cloned[index] = { ...cloned[index], sublabel: next };
                onChange(cloned);
              }}
              minHeightClassName="min-h-[60px]"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className={buttonClasses({ variant: "ghost", size: "xs" })}
                onClick={() => onChange(stats.filter((_, idx) => idx !== index))}
              >
                Kaldir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CardsListEditor({
  cards,
  onChange,
}: {
  cards: LandingCardItem[];
  onChange: (items: LandingCardItem[]) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--ui-text-primary)]">Kartlar</p>
        <button
          type="button"
          className={buttonClasses({ variant: "outline", size: "xs" })}
          onClick={() => onChange([...cards, { title: "", body: "", bullets: [], tags: [] }])}
        >
          Kart Ekle
        </button>
      </div>
      <div className="space-y-3">
        {cards.map((item, index) => (
          <div key={`card-${index}`} className="rounded-xl border border-[var(--ui-border-subtle)] p-2">
            <CmsRichTextEditor
              label={`Kart Eyebrow #${index + 1}`}
              value={item.eyebrow ?? ""}
              onChange={(next) => {
                const cloned = [...cards];
                cloned[index] = { ...cloned[index], eyebrow: next };
                onChange(cloned);
              }}
              minHeightClassName="min-h-[56px]"
            />
            <CmsRichTextEditor
              label={`Kart Baslik #${index + 1}`}
              value={item.title ?? ""}
              onChange={(next) => {
                const cloned = [...cards];
                cloned[index] = { ...cloned[index], title: next };
                onChange(cloned);
              }}
              minHeightClassName="min-h-[64px]"
            />
            <CmsRichTextEditor
              label={`Kart Aciklama #${index + 1}`}
              value={item.body ?? ""}
              onChange={(next) => {
                const cloned = [...cards];
                cloned[index] = { ...cloned[index], body: next };
                onChange(cloned);
              }}
              minHeightClassName="min-h-[84px]"
            />

            <div className="grid gap-2 md:grid-cols-2">
              <CmsRichTextEditor
                label={`CTA Metni #${index + 1}`}
                value={item.ctaLabel ?? ""}
                onChange={(next) => {
                  const cloned = [...cards];
                  cloned[index] = { ...cloned[index], ctaLabel: next };
                  onChange(cloned);
                }}
                minHeightClassName="min-h-[56px]"
              />
              <div className="space-y-1.5">
                <label className={labelClasses()}>CTA Linki #{index + 1}</label>
                <input
                  value={item.ctaHref ?? ""}
                  onChange={(event) => {
                    const cloned = [...cards];
                    cloned[index] = { ...cloned[index], ctaHref: event.target.value };
                    onChange(cloned);
                  }}
                  className={fieldClasses()}
                  placeholder="#lead-form"
                />
              </div>
            </div>

            <RichListEditor
              label={`Bullet Listesi #${index + 1}`}
              values={item.bullets ?? []}
              onChange={(next) => {
                const cloned = [...cards];
                cloned[index] = { ...cloned[index], bullets: next };
                onChange(cloned);
              }}
              addLabel="Bullet Ekle"
            />

            <RichListEditor
              label={`Tag Listesi #${index + 1}`}
              values={item.tags ?? []}
              onChange={(next) => {
                const cloned = [...cards];
                cloned[index] = { ...cloned[index], tags: next };
                onChange(cloned);
              }}
              addLabel="Tag Ekle"
            />

            <div className="mt-2 flex justify-end">
              <button
                type="button"
                className={buttonClasses({ variant: "ghost", size: "xs" })}
                onClick={() => onChange(cards.filter((_, idx) => idx !== index))}
              >
                Kaldir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FormTextsEditor({
  formTexts,
  onChange,
}: {
  formTexts: LandingFormTexts;
  onChange: (value: LandingFormTexts) => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-[var(--ui-border-subtle)] p-2">
      <CmsRichTextEditor
        label="Form Baslik"
        value={formTexts.title ?? ""}
        onChange={(next) => onChange({ ...formTexts, title: next })}
      />
      <CmsRichTextEditor
        label="Form Aciklama"
        value={formTexts.description ?? ""}
        onChange={(next) => onChange({ ...formTexts, description: next })}
      />
      <CmsRichTextEditor
        label="Submit Buton Metni"
        value={formTexts.submitLabel ?? ""}
        onChange={(next) => onChange({ ...formTexts, submitLabel: next })}
        minHeightClassName="min-h-[60px]"
      />
      <CmsRichTextEditor
        label="Onay Metni"
        value={formTexts.consentText ?? ""}
        onChange={(next) => onChange({ ...formTexts, consentText: next })}
      />
      <CmsRichTextEditor
        label="Form Notu"
        value={formTexts.note ?? ""}
        onChange={(next) => onChange({ ...formTexts, note: next })}
      />
      <CmsRichTextEditor
        label="Basari Mesaji"
        value={formTexts.successMessage ?? ""}
        onChange={(next) => onChange({ ...formTexts, successMessage: next })}
        minHeightClassName="min-h-[60px]"
      />
    </div>
  );
}

function ThemeEditor({
  theme,
  onChange,
}: {
  theme: LandingThemeTokens;
  onChange: (next: LandingThemeTokens) => void;
}) {
  const standardFields: Array<{ key: keyof LandingThemeTokens; label: string }> = [
    { key: "background", label: "Background" },
    { key: "surface", label: "Surface" },
    { key: "surfaceAlt", label: "Surface Alt" },
    { key: "card", label: "Card" },
    { key: "border", label: "Border" },
    { key: "textPrimary", label: "Text Primary" },
    { key: "textSecondary", label: "Text Secondary" },
    { key: "accent", label: "Accent" },
    { key: "accentHover", label: "Accent Hover" },
    { key: "success", label: "Success" },
    { key: "warning", label: "Warning" },
    { key: "heroBadgeBg", label: "Hero Badge Bg" },
    { key: "heroBadgeText", label: "Hero Badge Text" },
    { key: "buttonPrimaryBg", label: "Primary Button Bg" },
    { key: "buttonPrimaryText", label: "Primary Button Text" },
    { key: "buttonSecondaryBg", label: "Secondary Button Bg" },
    { key: "buttonSecondaryText", label: "Secondary Button Text" },
  ];

  const visualOverrideFields: Array<{ key: keyof LandingThemeTokens; label: string; type: "color" | "text" }> = [
    { key: "heroGradientFrom", label: "Hero Gradient From (Hex)", type: "color" },
    { key: "heroGradientVia", label: "Hero Gradient Via (Hex)", type: "color" },
    { key: "heroGradientTo", label: "Hero Gradient To (Hex)", type: "color" },
    { key: "headerBackground", label: "Header Background (Hex)", type: "color" },
    { key: "headerBorderColor", label: "Header Border (Hex or RGBA)", type: "text" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {standardFields.map((field) => (
          <div key={field.key} className="space-y-1.5 rounded-xl border border-[var(--ui-border-subtle)] p-3">
            <label className={labelClasses()}>{field.label}</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={theme[field.key] as string}
                onChange={(event) => onChange({ ...theme, [field.key]: event.target.value })}
                className="h-9 w-11 rounded border border-[var(--ui-border)] bg-transparent"
              />
              <input
                value={theme[field.key] as string}
                onChange={(event) => onChange({ ...theme, [field.key]: event.target.value })}
                className={fieldClasses()}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-[var(--ui-border-subtle)] pt-6">
        <h4 className="mb-4 text-sm font-semibold text-[var(--ui-text-primary)] uppercase tracking-wider">Visual Overrides (Görsel Özelleştirme)</h4>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visualOverrideFields.map((field) => (
            <div key={field.key} className="space-y-1.5 rounded-xl border border-[var(--ui-border-strong)] bg-[var(--ui-surface-subtle)]/20 p-3">
              <label className={labelClasses()}>{field.label}</label>
              <div className="flex items-center gap-2">
                {field.type === "color" && (
                  <input
                    type="color"
                    value={(theme[field.key] as string) || "#000000"}
                    onChange={(event) => onChange({ ...theme, [field.key]: event.target.value })}
                    className="h-9 w-11 rounded border border-[var(--ui-border)] bg-transparent"
                  />
                )}
                <input
                  value={(theme[field.key] as string) || ""}
                  onChange={(event) => onChange({ ...theme, [field.key]: event.target.value })}
                  className={fieldClasses()}
                  placeholder={field.type === "text" ? "rgba(255,255,255,0.1)" : "#hex"}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NavigationEditor({
  navItems,
  onChange,
}: {
  navItems: LandingNavigationItem[];
  onChange: (next: LandingNavigationItem[]) => void;
}) {
  const updateItem = (index: number, updater: (item: LandingNavigationItem) => LandingNavigationItem) => {
    const cloned = [...navItems];
    cloned[index] = updater(cloned[index]);
    onChange(cloned);
  };

  const updateChild = (
    itemIndex: number,
    childIndex: number,
    updater: (child: LandingNavigationChildItem) => LandingNavigationChildItem,
  ) => {
    updateItem(itemIndex, (item) => {
      const children = [...item.children];
      children[childIndex] = updater(children[childIndex]);
      return { ...item, children };
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--ui-text-secondary)]">
          Landing header kategorileri ve alt kategori linkleri.
        </p>
        <button
          type="button"
          className={buttonClasses({ variant: "outline", size: "sm" })}
          onClick={() =>
            onChange([
              ...navItems,
              {
                title: "",
                slug: "",
                href: "",
                sortOrder: navItems.length + 1,
                isActive: true,
                badgeText: null,
                openInNewTab: false,
                children: [],
              },
            ])
          }
        >
          Kategori Ekle
        </button>
      </div>

      <div className="space-y-4">
        {navItems.map((item, index) => (
          <article
            key={`nav-item-${index}-${item.slug}`}
            className="space-y-3 rounded-2xl border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-subtle)]/35 p-3"
          >
            <div className="grid gap-2 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className={labelClasses()}>Kategori Basligi</label>
                <input
                  value={item.title}
                  onChange={(event) => updateItem(index, (current) => ({ ...current, title: event.target.value }))}
                  className={fieldClasses()}
                  placeholder="Urun"
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClasses()}>Slug / Key</label>
                <input
                  value={item.slug}
                  onChange={(event) => updateItem(index, (current) => ({ ...current, slug: event.target.value }))}
                  className={fieldClasses()}
                  placeholder="urun"
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClasses()}>Hedef Link</label>
                <input
                  value={item.href}
                  onChange={(event) => updateItem(index, (current) => ({ ...current, href: event.target.value }))}
                  className={fieldClasses()}
                  placeholder="#features"
                />
              </div>
              <div className="space-y-1.5">
                <label className={labelClasses()}>Badge (Opsiyonel)</label>
                <input
                  value={item.badgeText ?? ""}
                  onChange={(event) =>
                    updateItem(index, (current) => ({ ...current, badgeText: event.target.value || null }))
                  }
                  className={fieldClasses()}
                  placeholder="Yeni"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-xs text-[var(--ui-text-secondary)]">
                <input
                  type="checkbox"
                  className={checkboxInputClasses()}
                  checked={item.isActive}
                  onChange={(event) =>
                    updateItem(index, (current) => ({ ...current, isActive: event.target.checked }))
                  }
                />
                Aktif
              </label>
              <label className="flex items-center gap-2 text-xs text-[var(--ui-text-secondary)]">
                <input
                  type="checkbox"
                  className={checkboxInputClasses()}
                  checked={Boolean(item.openInNewTab)}
                  onChange={(event) =>
                    updateItem(index, (current) => ({ ...current, openInNewTab: event.target.checked }))
                  }
                />
                Yeni sekmede ac
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--ui-text-secondary)]">Sira</span>
                <input
                  type="number"
                  min={1}
                  value={item.sortOrder}
                  onChange={(event) =>
                    updateItem(index, (current) => ({
                      ...current,
                      sortOrder: Number.parseInt(event.target.value || "0", 10) || current.sortOrder,
                    }))
                  }
                  className="h-9 w-20 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-bg)] px-2 text-sm"
                />
              </div>
              <button
                type="button"
                className={buttonClasses({ variant: "ghost", size: "xs", className: "ml-auto" })}
                onClick={() => onChange(navItems.filter((_, idx) => idx !== index))}
              >
                Kategoriyi Sil
              </button>
            </div>

            <div className="space-y-2 rounded-xl border border-[var(--ui-border-subtle)] p-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--ui-text-primary)]">Alt Kategoriler</p>
                <button
                  type="button"
                  className={buttonClasses({ variant: "outline", size: "xs" })}
                  onClick={() =>
                    updateItem(index, (current) => ({
                      ...current,
                      children: [
                        ...current.children,
                        {
                          title: "",
                          href: "",
                          sortOrder: current.children.length + 1,
                          isActive: true,
                          badgeText: null,
                          openInNewTab: false,
                        },
                      ],
                    }))
                  }
                >
                  Alt Kategori Ekle
                </button>
              </div>

              {item.children.length === 0 ? (
                <p className="text-xs text-[var(--ui-text-secondary)]">Alt kategori yok (opsiyonel).</p>
              ) : (
                <div className="space-y-2">
                  {item.children.map((child, childIndex) => (
                    <div key={`child-${index}-${childIndex}`} className="rounded-lg border border-[var(--ui-border-subtle)] p-2">
                      <div className="grid gap-2 md:grid-cols-2">
                        <div className="space-y-1.5">
                          <label className={labelClasses()}>Baslik</label>
                          <input
                            value={child.title}
                            onChange={(event) =>
                              updateChild(index, childIndex, (current) => ({ ...current, title: event.target.value }))
                            }
                            className={fieldClasses()}
                            placeholder="QR Menu"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className={labelClasses()}>Link</label>
                          <input
                            value={child.href}
                            onChange={(event) =>
                              updateChild(index, childIndex, (current) => ({ ...current, href: event.target.value }))
                            }
                            className={fieldClasses()}
                            placeholder="#features"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className={labelClasses()}>Badge (Opsiyonel)</label>
                          <input
                            value={child.badgeText ?? ""}
                            onChange={(event) =>
                              updateChild(index, childIndex, (current) => ({
                                ...current,
                                badgeText: event.target.value || null,
                              }))
                            }
                            className={fieldClasses()}
                            placeholder="Populer"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className={labelClasses()}>Sira</label>
                          <input
                            type="number"
                            min={1}
                            value={child.sortOrder}
                            onChange={(event) =>
                              updateChild(index, childIndex, (current) => ({
                                ...current,
                                sortOrder: Number.parseInt(event.target.value || "0", 10) || current.sortOrder,
                              }))
                            }
                            className={fieldClasses()}
                          />
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-4">
                        <label className="flex items-center gap-2 text-xs text-[var(--ui-text-secondary)]">
                          <input
                            type="checkbox"
                            className={checkboxInputClasses()}
                            checked={child.isActive}
                            onChange={(event) =>
                              updateChild(index, childIndex, (current) => ({
                                ...current,
                                isActive: event.target.checked,
                              }))
                            }
                          />
                          Aktif
                        </label>
                        <label className="flex items-center gap-2 text-xs text-[var(--ui-text-secondary)]">
                          <input
                            type="checkbox"
                            className={checkboxInputClasses()}
                            checked={Boolean(child.openInNewTab)}
                            onChange={(event) =>
                              updateChild(index, childIndex, (current) => ({
                                ...current,
                                openInNewTab: event.target.checked,
                              }))
                            }
                          />
                          Yeni sekmede ac
                        </label>
                        <button
                          type="button"
                          className={buttonClasses({ variant: "ghost", size: "xs", className: "ml-auto" })}
                          onClick={() =>
                            updateItem(index, (current) => ({
                              ...current,
                              children: current.children.filter((_, idx) => idx !== childIndex),
                            }))
                          }
                        >
                          Alt Kategoriyi Sil
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </article>
        ))}

        <div className="rounded-2xl border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-bg)] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ui-text-secondary)]">
            Header Onizleme
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {navItems
              .filter((item) => item.isActive)
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((item) => (
                <span
                  key={`preview-${item.slug}`}
                  className="inline-flex items-center gap-1 rounded-full border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-subtle)] px-2.5 py-1 text-xs text-[var(--ui-text-primary)]"
                >
                  <span>{item.title}</span>
                  {item.badgeText ? (
                    <span className="rounded-full bg-[var(--ui-surface-bg)] px-1.5 py-0.5 text-[10px] text-[var(--ui-accent)]">
                      {item.badgeText}
                    </span>
                  ) : null}
                </span>
              ))}
            {navItems.filter((item) => item.isActive).length === 0 ? (
              <p className="text-xs text-[var(--ui-text-secondary)]">Aktif kategori yok.</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionVisualsEditor({
  visuals = {},
  onChange,
}: {
  visuals?: LandingSectionVisuals;
  onChange: (next: LandingSectionVisuals) => void;
}) {
  return (
    <div className="mt-4 border-t border-[var(--ui-border-subtle)] pt-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--ui-text-muted)]">Görsel Özelleştirme (Visual Overrides)</h4>
        <label className="flex items-center gap-2 text-xs text-[var(--ui-text-secondary)]">
          <input
            type="checkbox"
            className={checkboxInputClasses()}
            checked={!!visuals.isEnabledVisuals}
            onChange={(e) => onChange({ ...visuals, isEnabledVisuals: e.target.checked })}
          />
          Override Aktif
        </label>
      </div>

      {visuals.isEnabledVisuals && (
        <div className="space-y-4 animate-in fade-in slide-in-from-top-1">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-[var(--ui-text-secondary)]">
              <input
                type="radio"
                checked={visuals.backgroundMode !== "custom"}
                onChange={() => onChange({ ...visuals, backgroundMode: "default" })}
              />
              Varsayılan (Default)
            </label>
            <label className="flex items-center gap-2 text-xs text-[var(--ui-text-secondary)]">
              <input
                type="radio"
                checked={visuals.backgroundMode === "custom"}
                onChange={() => onChange({ ...visuals, backgroundMode: "custom" })}
              />
              Özel (Custom)
            </label>
          </div>

          {visuals.backgroundMode === "custom" && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-1.5">
                <label className={labelClasses()}>Background Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={visuals.backgroundColor || "#020617"}
                    onChange={(e) => onChange({ ...visuals, backgroundColor: e.target.value })}
                    className="h-8 w-10 rounded border border-[var(--ui-border)]"
                  />
                  <input
                    value={visuals.backgroundColor || ""}
                    onChange={(e) => onChange({ ...visuals, backgroundColor: e.target.value })}
                    className={fieldClasses()}
                    placeholder="#hex"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelClasses()}>Gradient From</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={visuals.gradientFrom || "#020617"}
                    onChange={(e) => onChange({ ...visuals, gradientFrom: e.target.value })}
                    className="h-8 w-10 rounded border border-[var(--ui-border)]"
                  />
                  <input
                    value={visuals.gradientFrom || ""}
                    onChange={(e) => onChange({ ...visuals, gradientFrom: e.target.value })}
                    className={fieldClasses()}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelClasses()}>Gradient Via</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={visuals.gradientVia || "#0b3b8f"}
                    onChange={(e) => onChange({ ...visuals, gradientVia: e.target.value })}
                    className="h-8 w-10 rounded border border-[var(--ui-border)]"
                  />
                  <input
                    value={visuals.gradientVia || ""}
                    onChange={(e) => onChange({ ...visuals, gradientVia: e.target.value })}
                    className={fieldClasses()}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelClasses()}>Gradient To</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={visuals.gradientTo || "#071a3a"}
                    onChange={(e) => onChange({ ...visuals, gradientTo: e.target.value })}
                    className="h-8 w-10 rounded border border-[var(--ui-border)]"
                  />
                  <input
                    value={visuals.gradientTo || ""}
                    onChange={(e) => onChange({ ...visuals, gradientTo: e.target.value })}
                    className={fieldClasses()}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className={labelClasses()}>Border Color</label>
                <input
                  value={visuals.borderColor || ""}
                  onChange={(e) => onChange({ ...visuals, borderColor: e.target.value })}
                  className={fieldClasses()}
                  placeholder="rgba(255,255,255,0.08)"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FooterEditor({
  config,
  onChange,
}: {
  config: LandingFooterConfig;
  onChange: (next: LandingFooterConfig) => void;
}) {
  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm text-[var(--ui-text-secondary)]">
        <input
          type="checkbox"
          className={checkboxInputClasses()}
          checked={config.isEnabled}
          onChange={(e) => onChange({ ...config, isEnabled: e.target.checked })}
        />
        Footer Aktif
      </label>

      {config.isEnabled && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 border-t border-[var(--ui-border-subtle)] pt-4">
          <div className="space-y-1.5">
            <label className={labelClasses()}>Background Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.background || "#020617"}
                onChange={(e) => onChange({ ...config, background: e.target.value })}
                className="h-9 w-11 rounded border border-[var(--ui-border)]"
              />
              <input
                value={config.background || ""}
                onChange={(e) => onChange({ ...config, background: e.target.value })}
                className={fieldClasses()}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={labelClasses()}>Border Color</label>
            <input
              value={config.borderColor || ""}
              onChange={(e) => onChange({ ...config, borderColor: e.target.value })}
              className={fieldClasses()}
              placeholder="rgba(255,255,255,0.08)"
            />
          </div>
          <div className="space-y-1.5">
            <label className={labelClasses()}>Text Color</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={config.textColor || "#94a3b8"}
                onChange={(e) => onChange({ ...config, textColor: e.target.value })}
                className="h-9 w-11 rounded border border-[var(--ui-border)]"
              />
              <input
                value={config.textColor || ""}
                onChange={(e) => onChange({ ...config, textColor: e.target.value })}
                className={fieldClasses()}
              />
            </div>
          </div>
          <div className="md:col-span-2 lg:col-span-3">
            <CmsRichTextEditor
              label="Footer Ana İçerik (Rich Text)"
              value={config.contentRichText || ""}
              onChange={(next) => onChange({ ...config, contentRichText: next })}
            />
          </div>
          <div className="md:col-span-2 lg:col-span-3 space-y-1.5">
            <label className={labelClasses()}>Custom HTML / Code Snippet (Embed, Script vb.)</label>
            <textarea
              value={config.customCode || ""}
              onChange={(e) => onChange({ ...config, customCode: e.target.value })}
              className={`${fieldClasses()} min-h-[120px] font-mono text-xs`}
              placeholder="<!-- Google Analytics, Meta Pixel vb. -->"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function MarketingLandingBuilderForm({ site }: MarketingLandingBuilderFormProps) {
  const landingSectionsConfig = (site.landingSections ?? []).map((section) => ({
    sectionType: section.sectionType,
    isEnabled: section.isEnabled,
    sortOrder: section.sortOrder,
    eyebrowHtml: section.eyebrowHtml ?? "",
    titleHtml: section.titleHtml ?? "",
    subtitleHtml: section.subtitleHtml ?? "",
    bodyHtml: section.bodyHtml ?? "",
    ctaPrimaryLabelHtml: section.ctaPrimaryLabelHtml ?? "",
    ctaPrimaryHref: section.ctaPrimaryHref ?? "",
    ctaSecondaryLabelHtml: section.ctaSecondaryLabelHtml ?? "",
    ctaSecondaryHref: section.ctaSecondaryHref ?? "",
    mediaUrl: section.mediaUrl ?? "",
    mediaAlt: section.mediaAlt ?? "",
    mediaCaptionHtml: section.mediaCaptionHtml ?? "",
    payload: section.payload && typeof section.payload === "object" && !Array.isArray(section.payload) ? section.payload : {},
  })) as LandingSectionConfig[];

  const initialFooterConfig = (site.footerConfig && typeof site.footerConfig === "object" && !Array.isArray(site.footerConfig))
    ? (site.footerConfig as unknown as LandingFooterConfig)
    : DEFAULT_LANDING_FOOTER;

  const [footerConfig, setFooterConfig] = useState<LandingFooterConfig>(initialFooterConfig);

  // ... rest of the component state ...
  // ... in return:
  // <input type="hidden" name="footerConfigPayload" value={JSON.stringify(footerConfig)} />
  // ... new Footer section ...

  const landingNavigationItems = (site.landingNavItems ?? []).map((item) => ({
    id: item.id,
    title: item.title,
    slug: item.slug,
    href: item.href,
    sortOrder: item.sortOrder,
    isActive: item.isActive,
    badgeText: item.badgeText,
    openInNewTab: item.openInNewTab,
    children: (item.subitems ?? []).map((child) => ({
      id: child.id,
      title: child.title,
      href: child.href,
      sortOrder: child.sortOrder,
      isActive: child.isActive,
      badgeText: child.badgeText,
      openInNewTab: child.openInNewTab,
    })),
  })) as LandingNavigationItem[];
  const landingThemeTokens = site.landingTheme
    ? {
        background: site.landingTheme.background,
        surface: site.landingTheme.surface,
        surfaceAlt: site.landingTheme.surfaceAlt,
        card: site.landingTheme.card,
        border: site.landingTheme.border,
        textPrimary: site.landingTheme.textPrimary,
        textSecondary: site.landingTheme.textSecondary,
        accent: site.landingTheme.accent,
        accentHover: site.landingTheme.accentHover,
        success: site.landingTheme.success,
        warning: site.landingTheme.warning,
        heroBadgeBg: site.landingTheme.heroBadgeBg,
        heroBadgeText: site.landingTheme.heroBadgeText,
        buttonPrimaryBg: site.landingTheme.buttonPrimaryBg,
        buttonPrimaryText: site.landingTheme.buttonPrimaryText,
        buttonSecondaryBg: site.landingTheme.buttonSecondaryBg,
        buttonSecondaryText: site.landingTheme.buttonSecondaryText,
        // New fields
        heroGradientFrom: site.landingTheme.heroGradientFrom,
        heroGradientVia: site.landingTheme.heroGradientVia,
        heroGradientTo: site.landingTheme.heroGradientTo,
        headerBackground: site.landingTheme.headerBackground,
        headerBorderColor: site.landingTheme.headerBorderColor,
      }
    : DEFAULT_LANDING_THEME;

  const [state, action, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => {
      const result = await saveMarketingLandingBuilderAction(formData);
      return { ok: result.success, message: result.message };
    },
    INITIAL_STATE,
  );

  const initialSections = useMemo(
    () => [...landingSectionsConfig].sort((a, b) => a.sortOrder - b.sortOrder),
    [landingSectionsConfig],
  );
  const initialNavigationItems = useMemo(
    () =>
      [...landingNavigationItems]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => ({
          ...item,
          children: [...item.children].sort((a, b) => a.sortOrder - b.sortOrder),
        })),
    [landingNavigationItems],
  );

  const [theme, setTheme] = useState<LandingThemeTokens>(landingThemeTokens);
  const [sections, setSections] = useState<LandingSectionConfig[]>(initialSections);
  const [navItems, setNavItems] = useState<LandingNavigationItem[]>(initialNavigationItems);

  const updateSection = (index: number, updater: (item: LandingSectionConfig) => LandingSectionConfig) => {
    setSections((prev) => {
      const cloned = [...prev];
      cloned[index] = updater(cloned[index]);
      return cloned;
    });
  };

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="themePayload" value={JSON.stringify(theme)} />
      <input type="hidden" name="sectionsPayload" value={JSON.stringify(sections)} />
      <input type="hidden" name="navItemsPayload" value={JSON.stringify(navItems)} />

      <section className="space-y-3 rounded-2xl border border-[var(--ui-border)] p-4">
        <h3 className="text-base font-semibold text-[var(--ui-text-primary)]">Genel Yayin Ayarlari</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className={labelClasses()}>Marka Adi</label>
            <input name="brandName" defaultValue={site.brandName} className={fieldClasses()} required />
          </div>
          <div className="space-y-1.5">
            <label className={labelClasses()}>Marka Tagline</label>
            <input name="brandTagline" defaultValue={site.brandTagline ?? ""} className={fieldClasses()} />
          </div>
          <label className="flex items-center gap-2 text-sm text-[var(--ui-text-secondary)] md:col-span-2">
            <input
              name="isPublished"
              type="checkbox"
              value="true"
              defaultChecked={site.isPublished}
              className={checkboxInputClasses()}
            />
            Landing yayinda olsun
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5 md:col-span-2">
            <label className={labelClasses()}>SEO Title</label>
            <input name="seoTitle" defaultValue={site.seoTitle ?? ""} className={fieldClasses()} />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className={labelClasses()}>SEO Description</label>
            <input name="seoDescription" defaultValue={site.seoDescription ?? ""} className={fieldClasses()} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClasses()}>Canonical URL</label>
            <input name="seoCanonicalUrl" defaultValue={site.seoCanonicalUrl ?? ""} className={fieldClasses()} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClasses()}>OG Image URL</label>
            <input name="seoOgImageUrl" defaultValue={site.seoOgImageUrl ?? ""} className={fieldClasses()} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClasses()}>OG Title</label>
            <input name="seoOgTitle" defaultValue={site.seoOgTitle ?? ""} className={fieldClasses()} />
          </div>
          <div className="space-y-1.5">
            <label className={labelClasses()}>OG Description</label>
            <input name="seoOgDescription" defaultValue={site.seoOgDescription ?? ""} className={fieldClasses()} />
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-[var(--ui-border)] p-4">
        <h3 className="text-base font-semibold text-[var(--ui-text-primary)]">Theme / Color Tokens</h3>
        <p className="text-sm text-[var(--ui-text-secondary)]">
          Landing renk sistemi tamamen bu tokenlardan beslenir.
        </p>
        <ThemeEditor theme={theme} onChange={setTheme} />
      </section>

      <section className="space-y-3 rounded-2xl border border-[var(--ui-border)] p-4">
        <h3 className="text-base font-semibold text-[var(--ui-text-primary)]">Kategoriler (Header Navigation)</h3>
        <p className="text-sm text-[var(--ui-text-secondary)]">
          Landing ust bolumunde gorunecek kategori ve alt kategori linkleri. Siralama ve aktiflik buradan yonetilir.
        </p>
        <NavigationEditor navItems={navItems} onChange={setNavItems} />
      </section>

      <section className="space-y-3 rounded-2xl border border-[var(--ui-border)] p-4">
        <h3 className="text-base font-semibold text-[var(--ui-text-primary)]">Section Builder</h3>
        <p className="text-sm text-[var(--ui-text-secondary)]">
          Tumu schema-driven editor ile yonetilir. Ac/kapat, sirala ve metinleri ortak rich text editorde duzenle.
        </p>

        <div className="space-y-4">
          {sections
            .map((item, index) => ({ item, index }))
            .sort((a, b) => a.item.sortOrder - b.item.sortOrder)
            .map(({ item, index }) => {
              const spec = LANDING_SECTION_SPECS.find((entry) => entry.type === item.sectionType);
              if (!spec) return null;

              return (
                <article
                  key={item.sectionType}
                  className="space-y-3 rounded-2xl border border-[var(--ui-border-subtle)] bg-[var(--ui-surface-subtle)]/35 p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--ui-text-primary)]">{spec.label}</p>
                      <p className="text-xs text-[var(--ui-text-secondary)]">{spec.description}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs text-[var(--ui-text-secondary)]">
                        <input
                          type="checkbox"
                          className={checkboxInputClasses()}
                          checked={item.isEnabled}
                          onChange={(event) =>
                            updateSection(index, (current) => ({ ...current, isEnabled: event.target.checked }))
                          }
                        />
                        Aktif
                      </label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[var(--ui-text-secondary)]">Sira</span>
                        <input
                          type="number"
                          value={item.sortOrder}
                          min={1}
                          className="h-9 w-20 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-bg)] px-2 text-sm"
                          onChange={(event) =>
                            updateSection(index, (current) => ({
                              ...current,
                              sortOrder: Number.parseInt(event.target.value || "0", 10) || current.sortOrder,
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  {spec.supports.eyebrow ? (
                    <CmsRichTextEditor
                      label="Eyebrow"
                      value={item.eyebrowHtml}
                      onChange={(next) => updateSection(index, (current) => ({ ...current, eyebrowHtml: next }))}
                      minHeightClassName="min-h-[62px]"
                    />
                  ) : null}

                  {spec.supports.title ? (
                    <CmsRichTextEditor
                      label="Baslik"
                      value={item.titleHtml}
                      onChange={(next) => updateSection(index, (current) => ({ ...current, titleHtml: next }))}
                      minHeightClassName="min-h-[72px]"
                    />
                  ) : null}

                  {spec.supports.subtitle ? (
                    <CmsRichTextEditor
                      label="Alt Baslik"
                      value={item.subtitleHtml}
                      onChange={(next) => updateSection(index, (current) => ({ ...current, subtitleHtml: next }))}
                      minHeightClassName="min-h-[64px]"
                    />
                  ) : null}

                  {spec.supports.body ? (
                    <CmsRichTextEditor
                      label="Govde Metin"
                      value={item.bodyHtml}
                      onChange={(next) => updateSection(index, (current) => ({ ...current, bodyHtml: next }))}
                    />
                  ) : null}

                  {(spec.supports.ctaPrimary || spec.supports.ctaSecondary) && (
                    <div className="grid gap-2 md:grid-cols-2">
                      {spec.supports.ctaPrimary ? (
                        <>
                          <CmsRichTextEditor
                            label="Primary CTA Metni"
                            value={item.ctaPrimaryLabelHtml}
                            onChange={(next) =>
                              updateSection(index, (current) => ({ ...current, ctaPrimaryLabelHtml: next }))
                            }
                            minHeightClassName="min-h-[60px]"
                          />
                          <div className="space-y-1.5">
                            <label className={labelClasses()}>Primary CTA Linki</label>
                            <input
                              value={item.ctaPrimaryHref}
                              onChange={(event) =>
                                updateSection(index, (current) => ({ ...current, ctaPrimaryHref: event.target.value }))
                              }
                              className={fieldClasses()}
                              placeholder="#lead-form"
                            />
                          </div>
                        </>
                      ) : null}

                      {spec.supports.ctaSecondary ? (
                        <>
                          <CmsRichTextEditor
                            label="Secondary CTA Metni"
                            value={item.ctaSecondaryLabelHtml}
                            onChange={(next) =>
                              updateSection(index, (current) => ({ ...current, ctaSecondaryLabelHtml: next }))
                            }
                            minHeightClassName="min-h-[60px]"
                          />
                          <div className="space-y-1.5">
                            <label className={labelClasses()}>Secondary CTA Linki</label>
                            <input
                              value={item.ctaSecondaryHref}
                              onChange={(event) =>
                                updateSection(index, (current) => ({ ...current, ctaSecondaryHref: event.target.value }))
                              }
                              className={fieldClasses()}
                              placeholder="#features"
                            />
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}

                  {spec.supports.media ? (
                    <div className="grid gap-2 md:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className={labelClasses()}>Media URL</label>
                        <input
                          value={item.mediaUrl}
                          onChange={(event) =>
                            updateSection(index, (current) => ({ ...current, mediaUrl: event.target.value }))
                          }
                          className={fieldClasses()}
                          placeholder="https://..."
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className={labelClasses()}>Media Alt Text</label>
                        <input
                          value={item.mediaAlt}
                          onChange={(event) =>
                            updateSection(index, (current) => ({ ...current, mediaAlt: event.target.value }))
                          }
                          className={fieldClasses()}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <CmsRichTextEditor
                          label="Media Caption"
                          value={item.mediaCaptionHtml}
                          onChange={(next) =>
                            updateSection(index, (current) => ({ ...current, mediaCaptionHtml: next }))
                          }
                          minHeightClassName="min-h-[60px]"
                        />
                      </div>
                    </div>
                  ) : null}

                  {spec.supports.bullets ? (
                    <RichListEditor
                      label="Bulletlar"
                      values={item.payload.bullets ?? []}
                      onChange={(next) =>
                        updateSection(index, (current) => ({
                          ...current,
                          payload: { ...current.payload, bullets: next },
                        }))
                      }
                      addLabel="Bullet Ekle"
                    />
                  ) : null}

                  {spec.supports.badges ? (
                    <BadgeListEditor
                      badges={item.payload.badges ?? []}
                      onChange={(next) =>
                        updateSection(index, (current) => ({
                          ...current,
                          payload: { ...current.payload, badges: next },
                        }))
                      }
                    />
                  ) : null}

                  {spec.supports.stats ? (
                    <StatsListEditor
                      stats={item.payload.stats ?? []}
                      onChange={(next) =>
                        updateSection(index, (current) => ({
                          ...current,
                          payload: { ...current.payload, stats: next },
                        }))
                      }
                    />
                  ) : null}

                  {spec.supports.cards ? (
                    <CardsListEditor
                      cards={item.payload.cards ?? []}
                      onChange={(next) =>
                        updateSection(index, (current) => ({
                          ...current,
                          payload: { ...current.payload, cards: next },
                        }))
                      }
                    />
                  ) : null}

                  {spec.supports.formTexts ? (
                    <FormTextsEditor
                      formTexts={item.payload.formTexts ?? {}}
                      onChange={(next) =>
                        updateSection(index, (current) => ({
                          ...current,
                          payload: { ...current.payload, formTexts: next },
                        }))
                      }
                    />
                  ) : null}
                </article>
              );
            })}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={isPending} className={buttonClasses({ variant: "primary" })}>
          {isPending ? "Kaydediliyor..." : "Landing CMS Ayarlarini Kaydet"}
        </button>
        {state.message ? (
          <p className={`text-sm ${state.ok ? "text-emerald-700" : "text-rose-700"}`}>{state.message}</p>
        ) : null}
      </div>
    </form>
  );
}
