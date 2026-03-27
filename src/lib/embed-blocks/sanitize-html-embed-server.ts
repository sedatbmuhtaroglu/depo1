import { parseHTML } from "linkedom";
import {
  collectSandboxedIframesFromBody,
  prepareHtmlEmbedInput,
} from "@/lib/embed-blocks/sanitize-html-embed-core";
import { EMBED_BLOCK_RAW_MAX } from "@/modules/content/shared/embed-blocks";

export function sanitizeHtmlEmbedBlockServer(
  html: string,
  maxLength: number = EMBED_BLOCK_RAW_MAX,
): { ok: true; html: string } | { ok: false; error: string } {
  const clean = prepareHtmlEmbedInput(html, maxLength);
  if (!clean.trim()) {
    return { ok: false, error: "HTML Embed: Icerik bos." };
  }
  const wrapped = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${clean}</body></html>`;
  const { document } = parseHTML(wrapped);
  const body = document.body as unknown as HTMLElement;
  return collectSandboxedIframesFromBody(body, document as unknown as Document);
}
