/**
 * Content embed blocks — stored separately from rich text `contentHtml`.
 * Persisted shape is always server-sanitized before save.
 */

export type ContentEmbedBlockKind = "html_embed" | "custom_code";

/** Persisted row in `Page.embedBlocks` / `BlogPost.embedBlocks` JSON */
export type ContentEmbedBlockStored = {
  id: string;
  kind: ContentEmbedBlockKind;
  /** Sanitized HTML fragment safe for the block kind */
  html: string;
};

/** Client → server payload (raw editor HTML before sanitization) */
export type ContentEmbedBlockDraft = {
  id: string;
  kind: ContentEmbedBlockKind;
  rawHtml: string;
};

export const EMBED_BLOCKS_MAX_COUNT = 12;
export const EMBED_BLOCK_RAW_MAX = 50_000;
export const HTML_EMBED_IFRAME_MAX = 5;

/** Loads persisted JSON into editor draft state (rawHtml = last saved sanitized HTML). */
export function parseStoredEmbedBlocksForEditor(value: unknown): ContentEmbedBlockDraft[] {
  if (!value || !Array.isArray(value)) return [];
  const out: ContentEmbedBlockDraft[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string" || r.id.length === 0) continue;
    if (r.kind !== "html_embed" && r.kind !== "custom_code") continue;
    const html = typeof r.html === "string" ? r.html : "";
    out.push({ id: r.id, kind: r.kind, rawHtml: html });
  }
  return out;
}

/** Defensive parse for public render (DB JSON). */
export function normalizeEmbedBlocksForRender(value: unknown): ContentEmbedBlockStored[] {
  if (!value || !Array.isArray(value)) return [];
  const out: ContentEmbedBlockStored[] = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    if (typeof r.id !== "string" || r.id.length === 0) continue;
    if (r.kind !== "html_embed" && r.kind !== "custom_code") continue;
    const html = typeof r.html === "string" ? r.html : "";
    out.push({ id: r.id, kind: r.kind, html });
  }
  return out;
}
