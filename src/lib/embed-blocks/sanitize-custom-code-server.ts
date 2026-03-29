import { parseHTML } from "linkedom";
import { stripScriptsStylesComments } from "@/lib/sanitize-rich-html-walk";
import {
  findDisallowedCustomCodeTag,
  sanitizeCustomCodeBody,
} from "@/lib/embed-blocks/sanitize-custom-code-walk";
import { EMBED_BLOCK_RAW_MAX } from "@/modules/content/shared/embed-blocks";

export function sanitizeCustomCodeBlockServer(
  html: string,
  maxLength: number = EMBED_BLOCK_RAW_MAX,
): { ok: true; html: string } | { ok: false; error: string } {
  const normalized = html.trim().slice(0, maxLength);
  if (!normalized) {
    return { ok: false, error: "Custom Code: Icerik bos." };
  }
  const clean = stripScriptsStylesComments(normalized);
  const wrapped = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${clean}</body></html>`;
  const { document } = parseHTML(wrapped);
  const body = document.body as unknown as HTMLElement;

  const bad = findDisallowedCustomCodeTag(body);
  if (bad) {
    const hint =
      bad === "iframe"
        ? ' Iframe icin "HTML Embed" blogunu kullanin.'
        : bad === "form"
          ? " Form etiketleri guvenlik nedeniyle desteklenmiyor."
          : "";
    return {
      ok: false,
      error: `Custom Code: Desteklenmeyen etiket: <${bad}>.${hint}`,
    };
  }

  sanitizeCustomCodeBody(body, document as unknown as Document);
  return { ok: true, html: body.innerHTML.trim() };
}
