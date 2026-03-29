import { parseHTML } from "linkedom";
import { sanitizeBodyChildren, stripScriptsStylesComments } from "./sanitize-rich-html-walk";

/**
 * Server-side: same semantics as client (preserved blocks as pre/code text).
 */
export function sanitizeRichHtmlServer(html: string, maxLength: number): string {
  if (!html) return "";
  const clean = stripScriptsStylesComments(html.slice(0, maxLength));
  const wrapped = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${clean}</body></html>`;
  const { document } = parseHTML(wrapped);
  sanitizeBodyChildren(document.body, document as unknown as Document);
  return document.body.innerHTML.trim();
}
