import { parseHTML } from "linkedom";
import { prepareSourceHtmlInput, sanitizeSourceBodyChildren } from "@/lib/sanitize-source-html-walk";

/** Server: same rules as `sanitizeSourceHtmlClient` (linkedom Document). */
export function sanitizeSourceHtmlServer(html: string, maxLength: number): string {
  if (!html) return "";
  const clean = prepareSourceHtmlInput(html, maxLength);
  const wrapped = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${clean}</body></html>`;
  const { document } = parseHTML(wrapped);
  const body = document.body as unknown as HTMLElement;
  sanitizeSourceBodyChildren(body, document as unknown as Document);
  return body.innerHTML.trim();
}
