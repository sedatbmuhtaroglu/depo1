import type { Prisma } from "@prisma/client";
import { sanitizeCustomCodeBlockServer } from "@/lib/embed-blocks/sanitize-custom-code-server";
import { sanitizeHtmlEmbedBlockServer } from "@/lib/embed-blocks/sanitize-html-embed-server";
import { EMBED_BLOCK_RAW_MAX, EMBED_BLOCKS_MAX_COUNT, type ContentEmbedBlockStored } from "@/modules/content/shared/embed-blocks";

export function normalizeEmbedBlocksInput(
  formValue: FormDataEntryValue | null,
): { ok: true; blocks: ContentEmbedBlockStored[] } | { ok: false; message: string } {
  const raw = (formValue?.toString() ?? "").trim();
  if (!raw) return { ok: true, blocks: [] };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, message: "Embed bloklari gecersiz JSON." };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, message: "Embed bloklari dizi olmalidir." };
  }
  if (parsed.length > EMBED_BLOCKS_MAX_COUNT) {
    return { ok: false, message: `En fazla ${EMBED_BLOCKS_MAX_COUNT} embed blogu eklenebilir.` };
  }

  const out: ContentEmbedBlockStored[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    if (!row || typeof row !== "object") {
      return { ok: false, message: `Embed blogu ${i + 1}: gecersiz.` };
    }
    const entry = row as Record<string, unknown>;
    const id = typeof entry.id === "string" && entry.id.length > 0 && entry.id.length < 120 ? entry.id : null;
    const kind = entry.kind === "html_embed" || entry.kind === "custom_code" ? entry.kind : null;
    const rawHtml = typeof entry.rawHtml === "string" ? entry.rawHtml : "";

    if (!id || !kind) {
      return { ok: false, message: `Embed blogu ${i + 1}: id veya tip eksik.` };
    }

    if (rawHtml.trim().length === 0) {
      continue;
    }

    if (rawHtml.length > EMBED_BLOCK_RAW_MAX) {
      return { ok: false, message: `Embed blogu ${i + 1}: metin cok uzun (max ${EMBED_BLOCK_RAW_MAX}).` };
    }

    if (kind === "html_embed") {
      const r = sanitizeHtmlEmbedBlockServer(rawHtml);
      if (!r.ok) return { ok: false, message: `Embed blogu ${i + 1} (HTML Embed): ${r.error}` };
      out.push({ id, kind, html: r.html });
    } else {
      const r = sanitizeCustomCodeBlockServer(rawHtml);
      if (!r.ok) return { ok: false, message: `Embed blogu ${i + 1} (Custom Code): ${r.error}` };
      out.push({ id, kind, html: r.html });
    }
  }

  return { ok: true, blocks: out };
}

export function embedBlocksToPrismaJson(blocks: ContentEmbedBlockStored[]): Prisma.InputJsonValue {
  return blocks as unknown as Prisma.InputJsonValue;
}
