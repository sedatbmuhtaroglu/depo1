import { stripScriptsStylesComments } from "@/lib/sanitize-rich-html-walk";
import { HTML_EMBED_IFRAME_MAX } from "@/modules/content/shared/embed-blocks";

/** Sandboxed third-party embeds (maps, video, widgets). Parent page stays isolated from iframe JS. */
export const HTML_EMBED_IFRAME_SANDBOX =
  "allow-scripts allow-same-origin allow-popups allow-forms allow-presentation allow-modals";

const IFRAME_COPY_ATTRS = [
  "width",
  "height",
  "class",
  "title",
  "name",
  "allow",
  "allowfullscreen",
  "referrerpolicy",
] as const;

function isValidHttpsIframeSrc(src: string): boolean {
  try {
    const u = new URL(src);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Extracts and rebuilds iframe elements with https-only src, no srcdoc, fixed sandbox.
 * Works with browser DOM or linkedom Document.
 */
export function collectSandboxedIframesFromBody(
  body: HTMLElement,
  doc: Document,
): { ok: true; html: string } | { ok: false; error: string } {
  const iframes = body.querySelectorAll("iframe");
  if (iframes.length === 0) {
    return {
      ok: false,
      error:
        "HTML Embed: En az bir iframe gerekir. Yalnizca https adresli iframe (or. harita, video) desteklenir.",
    };
  }
  if (iframes.length > HTML_EMBED_IFRAME_MAX) {
    return { ok: false, error: `HTML Embed: En fazla ${HTML_EMBED_IFRAME_MAX} iframe eklenebilir.` };
  }

  const container = doc.createElement("div");
  container.className = "content-embed-html-embed-root";

  for (const iframe of iframes) {
    const src = iframe.getAttribute("src")?.trim() ?? "";
    if (!src || !isValidHttpsIframeSrc(src)) {
      return {
        ok: false,
        error: "HTML Embed: Her iframe icin gecerli bir https:// URL gerekir.",
      };
    }

    const out = doc.createElement("iframe");
    out.setAttribute("src", src);
    out.setAttribute("sandbox", HTML_EMBED_IFRAME_SANDBOX);
    out.setAttribute("loading", "lazy");

    for (const key of IFRAME_COPY_ATTRS) {
      const v = iframe.getAttribute(key);
      if (v != null && v.length > 0 && v.length < 4000) {
        out.setAttribute(key, v);
      }
    }
    if (!out.getAttribute("referrerpolicy")) {
      out.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
    }
    // Never allow srcdoc (XSS / script injection into iframe document).
    out.removeAttribute("srcdoc");

    container.appendChild(out);
  }

  return { ok: true, html: container.innerHTML };
}

export function prepareHtmlEmbedInput(html: string, maxLength: number): string {
  return stripScriptsStylesComments(html.trim().slice(0, maxLength));
}
