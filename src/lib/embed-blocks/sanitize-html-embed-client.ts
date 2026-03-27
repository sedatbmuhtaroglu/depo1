"use client";

import {
  collectSandboxedIframesFromBody,
  prepareHtmlEmbedInput,
} from "@/lib/embed-blocks/sanitize-html-embed-core";
import { EMBED_BLOCK_RAW_MAX } from "@/modules/content/shared/embed-blocks";

/** Client-side preview (same rules as server). */
export function sanitizeHtmlEmbedBlockClient(
  html: string,
  maxLength: number = EMBED_BLOCK_RAW_MAX,
): { ok: true; html: string } | { ok: false; error: string } {
  const clean = prepareHtmlEmbedInput(html, maxLength);
  if (!clean.trim()) {
    return { ok: false, error: "HTML Embed: Icerik bos." };
  }
  const doc = new DOMParser().parseFromString(
    `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${clean}</body></html>`,
    "text/html",
  );
  return collectSandboxedIframesFromBody(doc.body, doc);
}
