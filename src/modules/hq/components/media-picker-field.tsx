"use client";

import { useMemo, useState } from "react";
import {
  buttonClasses,
  fieldClasses,
  labelClasses,
  textareaClasses,
} from "@/lib/ui/button-variants";

export type MediaAssetOption = {
  id: number;
  storagePath: string;
  title: string | null;
  altText: string | null;
  caption: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  byteSize: number;
  createdAt: Date | string;
  fileName: string;
};

type MediaPickerFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  assets: MediaAssetOption[];
  placeholder?: string;
  helperText?: string;
  suggestAltText?: boolean;
  altTextValue?: string;
  onAltTextChange?: (value: string) => void;
};

function formatSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDate(value: Date | string): string {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export function MediaPickerField({
  label,
  value,
  onChange,
  assets,
  placeholder = "https://... veya /uploads/...",
  helperText,
  suggestAltText = false,
  altTextValue = "",
  onAltTextChange,
}: MediaPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assets;

    return assets.filter((asset) => {
      const haystack = [asset.title, asset.altText, asset.caption, asset.storagePath]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [assets, search]);

  return (
    <div className="space-y-1.5">
      <label className={labelClasses()}>{label}</label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={fieldClasses({ className: "flex-1" })}
          placeholder={placeholder}
        />
        <button type="button" className={buttonClasses({ variant: "outline" })} onClick={() => setOpen(true)}>
          Kutuphaneden Sec
        </button>
      </div>

      {suggestAltText && onAltTextChange ? (
        <div>
          <label className={labelClasses("text-xs")}>Alt Text (onerilir)</label>
          <textarea
            value={altTextValue}
            onChange={(event) => onAltTextChange(event.target.value)}
            className={textareaClasses({ className: "mt-1 min-h-[74px]" })}
            placeholder="Gorselin ne anlattigini kisaca yazin"
          />
        </div>
      ) : null}

      {helperText ? <p className="text-xs text-[var(--ui-text-secondary)]">{helperText}</p> : null}

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-slate-950/65 p-4 sm:items-center">
          <div className="max-h-[88vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-[var(--ui-border)] bg-[var(--ui-surface)]">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--ui-border)] p-4">
              <div>
                <p className="text-sm font-semibold text-[var(--ui-text-primary)]">Media Library</p>
                <p className="text-xs text-[var(--ui-text-secondary)]">Mevcut gorseller arasindan secin.</p>
              </div>
              <button type="button" className={buttonClasses({ variant: "ghost", size: "sm" })} onClick={() => setOpen(false)}>
                Kapat
              </button>
            </div>

            <div className="border-b border-[var(--ui-border)] p-4">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Baslik / alt text / yol ara"
                className={fieldClasses()}
              />
            </div>

            <div className="max-h-[64vh] overflow-y-auto p-4">
              {filtered.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[var(--ui-border)] p-6 text-sm text-[var(--ui-text-secondary)]">
                  Sonuc bulunamadi.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((asset) => (
                    <article key={asset.id} className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] p-3">
                      <img
                        src={asset.storagePath}
                        alt={asset.altText ?? asset.title ?? "media"}
                        className="h-36 w-full rounded-lg border border-[var(--ui-border-subtle)] object-cover"
                      />
                      <p className="mt-2 line-clamp-1 text-sm font-semibold text-[var(--ui-text-primary)]">
                        {asset.title || asset.fileName || "Isimsiz"}
                      </p>
                      <p className="line-clamp-1 text-xs text-[var(--ui-text-secondary)]">{asset.storagePath}</p>
                      <p className="mt-1 text-[11px] text-[var(--ui-text-secondary)]">
                        {asset.width && asset.height ? `${asset.width}x${asset.height}` : "Olcu yok"} - {formatSize(asset.byteSize)}
                      </p>
                      <p className="text-[11px] text-[var(--ui-text-secondary)]">{formatDate(asset.createdAt)}</p>

                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          className={buttonClasses({ variant: "primary", size: "xs" })}
                          onClick={() => {
                            onChange(asset.storagePath);
                            if (suggestAltText && onAltTextChange && !altTextValue.trim() && asset.altText) {
                              onAltTextChange(asset.altText);
                            }
                            setOpen(false);
                          }}
                        >
                          Sec
                        </button>
                        <button
                          type="button"
                          className={buttonClasses({ variant: "outline", size: "xs" })}
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(asset.storagePath);
                            } catch {
                              // ignore clipboard errors
                            }
                          }}
                        >
                          URL Kopyala
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
