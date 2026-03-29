import { sanitizeBodyChildren, stripScriptsStylesComments } from "./sanitize-rich-html-walk";

/**
 * Browser-only: sanitize rich HTML for the TipTap editor (client).
 */
export function sanitizeRichHtmlClient(html: string, maxLength = 40_000): string {
  if (!html) return "";
  const clean = stripScriptsStylesComments(html.slice(0, maxLength));
  const doc = new DOMParser().parseFromString(clean, "text/html");
  sanitizeBodyChildren(doc.body, doc);
  return doc.body.innerHTML.trim();
}
