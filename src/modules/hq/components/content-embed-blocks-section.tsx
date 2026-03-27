"use client";

import { useMemo, useState } from "react";
import { buttonClasses, labelClasses, textareaClasses } from "@/lib/ui/button-variants";
import { sanitizeCustomCodeBlockClient } from "@/lib/embed-blocks/sanitize-custom-code-client";
import { sanitizeHtmlEmbedBlockClient } from "@/lib/embed-blocks/sanitize-html-embed-client";
import type { ContentEmbedBlockDraft, ContentEmbedBlockKind } from "@/modules/content/shared/embed-blocks";

type ContentEmbedBlocksSectionProps = {
  blocks: ContentEmbedBlockDraft[];
  onChange: (next: ContentEmbedBlockDraft[]) => void;
  hiddenInputName: string;
};

function newBlock(kind: ContentEmbedBlockKind): ContentEmbedBlockDraft {
  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `emb-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    kind,
    rawHtml: "",
  };
}

export function ContentEmbedBlocksSection({
  blocks,
  onChange,
  hiddenInputName,
}: ContentEmbedBlocksSectionProps) {
  const [previewId, setPreviewId] = useState<string | null>(null);

  const hiddenValue = JSON.stringify(blocks);

  const previewResult = useMemo(() => {
    if (!previewId) return null;
    const block = blocks.find((b) => b.id === previewId);
    if (!block) return null;
    return block.kind === "html_embed"
      ? sanitizeHtmlEmbedBlockClient(block.rawHtml)
      : sanitizeCustomCodeBlockClient(block.rawHtml);
  }, [blocks, previewId]);

  function updateBlock(id: string, rawHtml: string) {
    onChange(blocks.map((b) => (b.id === id ? { ...b, rawHtml } : b)));
  }

  function removeBlock(id: string) {
    onChange(blocks.filter((b) => b.id !== id));
    if (previewId === id) setPreviewId(null);
  }

  function moveBlock(id: string, dir: -1 | 1) {
    const i = blocks.findIndex((b) => b.id === id);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= blocks.length) return;
    const next = [...blocks];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  }

  function addKind(kind: ContentEmbedBlockKind) {
    onChange([...blocks, newBlock(kind)]);
  }

  return (
    <div className="space-y-3 rounded-2xl border border-dashed border-[var(--ui-border)] bg-[var(--ui-surface-muted)]/40 p-4">
      <input type="hidden" name={hiddenInputName} value={hiddenValue} readOnly />

      <div className="space-y-1">
        <p className="text-sm font-semibold text-[var(--ui-text-primary)]">Embed ve ozel HTML bloklari</p>
        <p className="text-xs leading-relaxed text-[var(--ui-text-secondary)]">
          <strong className="text-[var(--ui-text-primary)]">Rich text alani</strong> guvenli metin duzenleyicisidir;
          icerige yapistirilan ham HTML kod blogu olarak saklanir, calistirilmaz.
        </p>
        <p className="text-xs leading-relaxed text-[var(--ui-text-secondary)]">
          Asagidaki bloklar <strong className="text-[var(--ui-text-primary)]">bilincli</strong> eklenir:{" "}
          <strong>HTML Embed</strong> (iframe ile harita/video), <strong>Custom Code</strong> (statik HTML; script ve form
          yok). Kayit sirasinda sunucu tekrar dogrular; hata varsa sessizce yutulmaz.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClasses({ variant: "outline", size: "sm" })}
          onClick={() => addKind("html_embed")}
        >
          + HTML Embed
        </button>
        <button
          type="button"
          className={buttonClasses({ variant: "outline", size: "sm" })}
          onClick={() => addKind("custom_code")}
        >
          + Custom Code
        </button>
      </div>

      {blocks.length === 0 ? (
        <p className="text-xs text-[var(--ui-text-tertiary)]">Henuz embed blogu yok. Yukaridaki dugmelerle ekleyin.</p>
      ) : (
        <ul className="space-y-4">
          {blocks.map((block, index) => (
            <li
              key={block.id}
              className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface)] p-3 shadow-sm"
            >
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
                  {block.kind === "html_embed" ? "HTML Embed" : "Custom Code"} #{index + 1}
                </span>
                <div className="flex flex-wrap gap-1">
                  <button
                    type="button"
                    className={buttonClasses({ variant: "ghost", size: "sm" })}
                    onClick={() => moveBlock(block.id, -1)}
                    disabled={index === 0}
                  >
                    Yukari
                  </button>
                  <button
                    type="button"
                    className={buttonClasses({ variant: "ghost", size: "sm" })}
                    onClick={() => moveBlock(block.id, 1)}
                    disabled={index === blocks.length - 1}
                  >
                    Asagi
                  </button>
                  <button
                    type="button"
                    className={buttonClasses({ variant: "ghost", size: "sm" })}
                    onClick={() => setPreviewId(previewId === block.id ? null : block.id)}
                  >
                    {previewId === block.id ? "Onizlemeyi gizle" : "Onizleme"}
                  </button>
                  <button
                    type="button"
                    className={buttonClasses({ variant: "ghost", size: "sm" })}
                    onClick={() => removeBlock(block.id)}
                  >
                    Kaldir
                  </button>
                </div>
              </div>

              {block.kind === "html_embed" ? (
                <p className="mb-2 text-[11px] leading-snug text-[var(--ui-text-secondary)]">
                  Yalnizca <code className="rounded bg-[var(--ui-surface-muted)] px-1">https://</code> adresli{" "}
                  <code className="rounded bg-[var(--ui-surface-muted)] px-1">&lt;iframe&gt;</code> (en fazla 5).{" "}
                  <code className="rounded bg-[var(--ui-surface-muted)] px-1">srcdoc</code> kaldirilir; sandbox
                  uygulanir.
                </p>
              ) : (
                <p className="mb-2 text-[11px] leading-snug text-[var(--ui-text-secondary)]">
                  Metin, baslik, liste, tablo, resim, link ve layout etiketleri.{" "}
                  <strong className="text-[var(--ui-text-primary)]">Script, iframe, form</strong> desteklenmez.
                </p>
              )}

              <label className={labelClasses("sr-only")} htmlFor={`embed-${block.id}`}>
                {block.kind === "html_embed" ? "HTML Embed kodu" : "Custom Code HTML"}
              </label>
              <textarea
                id={`embed-${block.id}`}
                value={block.rawHtml}
                onChange={(e) => updateBlock(block.id, e.target.value)}
                className={textareaClasses({ className: "min-h-[140px] font-mono text-xs" })}
                spellCheck={false}
                placeholder={
                  block.kind === "html_embed"
                    ? '<iframe src="https://..." ...></iframe>'
                    : "<div>...</div> veya tablo / resim HTML'i"
                }
              />

              {previewId === block.id ? (
                <div className="mt-3 rounded-lg border border-[var(--ui-border)] bg-[var(--ui-surface-muted)] p-3">
                  {previewResult && previewResult.ok ? (
                    block.kind === "html_embed" ? (
                      <div
                        className="[&_iframe]:min-h-[180px] [&_iframe]:w-full [&_iframe]:rounded-md [&_iframe]:border [&_iframe]:border-[var(--ui-border)]"
                        dangerouslySetInnerHTML={{ __html: previewResult.html }}
                      />
                    ) : (
                      <div
                        className="prose prose-invert max-w-none text-sm [&_a]:text-emerald-400"
                        dangerouslySetInnerHTML={{ __html: previewResult.html }}
                      />
                    )
                  ) : previewResult ? (
                    <p className="text-xs font-medium text-red-400" role="alert">
                      {previewResult.error}
                    </p>
                  ) : (
                    <p className="text-xs text-[var(--ui-text-secondary)]">Onizleme icin kod girin.</p>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
