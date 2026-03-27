import { prepareSourceHtmlInput, sanitizeSourceBodyChildren } from "@/lib/sanitize-source-html-walk";

/** Client: source dialog "Uygula" + must match server persistence rules. */
export function sanitizeSourceHtmlClient(html: string, maxLength = 40_000): string {
  if (!html) return "";
  const clean = prepareSourceHtmlInput(html, maxLength);
  const doc = new DOMParser().parseFromString(clean, "text/html");
  sanitizeSourceBodyChildren(doc.body, doc);
  return doc.body.innerHTML.trim();
}
