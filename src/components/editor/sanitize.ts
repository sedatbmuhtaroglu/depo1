/**
 * Client-side helpers for the rich text editor.
 * HTML sanitization uses DOM + allowlist; disallowed markup is preserved as visible code blocks
 * (see `sanitize-rich-html-client.ts`).
 */

import { sanitizeRichHtmlClient } from "@/lib/sanitize-rich-html-client";
import { sanitizeSourceHtmlClient } from "@/lib/sanitize-source-html-client";

export function sanitizeEditorHtml(html: string, maxLength = 40_000): string {
  return sanitizeRichHtmlClient(html, maxLength);
}

/** Source dialog "Uygula": wider allowlist + same rules as server persistence. */
export function sanitizeSourceHtmlForEditor(html: string, maxLength = 40_000): string {
  return sanitizeSourceHtmlClient(html, maxLength);
}

/**
 * Strip all HTML tags and return plain text.
 */
export function stripHtmlClient(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Count words in a string.
 */
export function countWords(text: string): number {
  const stripped = stripHtmlClient(text);
  if (!stripped) return 0;
  return stripped.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Count characters in content (plain text, no tags).
 */
export function countCharacters(text: string): number {
  return stripHtmlClient(text).length;
}
