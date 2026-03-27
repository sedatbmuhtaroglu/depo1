"use client";

import { stripScriptsStylesComments } from "@/lib/sanitize-rich-html-walk";
import {
  findDisallowedCustomCodeTag,
  sanitizeCustomCodeBody,
} from "@/lib/embed-blocks/sanitize-custom-code-walk";
import { EMBED_BLOCK_RAW_MAX } from "@/modules/content/shared/embed-blocks";

/** Client-side preview (same rules as server). */
export function sanitizeCustomCodeBlockClient(
  html: string,
  maxLength: number = EMBED_BLOCK_RAW_MAX,
): { ok: true; html: string } | { ok: false; error: string } {
  const normalized = html.trim().slice(0, maxLength);
  if (!normalized) {
    return { ok: false, error: "Custom Code: Icerik bos." };
  }
  const clean = stripScriptsStylesComments(normalized);
  const doc = new DOMParser().parseFromString(
    `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${clean}</body></html>`,
    "text/html",
  );

  const bad = findDisallowedCustomCodeTag(doc.body);
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

  sanitizeCustomCodeBody(doc.body, doc);
  return { ok: true, html: doc.body.innerHTML.trim() };
}
