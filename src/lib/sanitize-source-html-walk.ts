/**
 * "Source HTML" mode: wider allowlist than paste/rich (see ALLOWED_RICH_HTML_TAGS).
 * Used for: editor source dialog "Uygula", and server-side persistence (must match).
 * Disallowed tags still become visible <pre><code class="rte-preserved-block"> (paste path unchanged).
 */

import { DOM_NODE_COMMENT, DOM_NODE_ELEMENT, DOM_NODE_TEXT } from "@/lib/dom-node-types";
import { ALLOWED_RICH_HTML_TAGS, stripScriptsStylesComments } from "@/lib/sanitize-rich-html-walk";

export const ALLOWED_SOURCE_HTML_TAGS = new Set([
  ...ALLOWED_RICH_HTML_TAGS,
  "div",
  "section",
  "article",
  "span",
  "img",
  "form",
  "label",
  "input",
  "button",
]);

function isAllowedSourceHref(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (v.startsWith("javascript:") || v.startsWith("data:") || v.startsWith("vbscript:")) return false;
  return (
    v.startsWith("/") ||
    v.startsWith("#") ||
    v.startsWith("http://") ||
    v.startsWith("https://") ||
    v.startsWith("mailto:") ||
    v.startsWith("tel:")
  );
}

function isAllowedImgSrc(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  const lower = v.toLowerCase();
  if (lower.startsWith("javascript:") || lower.startsWith("data:")) return false;
  return v.startsWith("/") || lower.startsWith("http://") || lower.startsWith("https://");
}

/** Strip dangerous CSS; allow basic layout/color/spacing for editor preview. */
export function sanitizeInlineStyle(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value
    .replace(/expression\s*\(/gi, "")
    .replace(/url\s*\(\s*["']?\s*javascript:/gi, "url(")
    .replace(/@import/gi, "")
    .replace(/behavior\s*:/gi, "")
    .replace(/-moz-binding/gi, "")
    .replace(/binding\s*:/gi, "");
  const trimmed = cleaned.trim();
  if (trimmed.length > 4000) return trimmed.slice(0, 4000);
  return trimmed || null;
}

function copySafeElementAttributes(el: Element, clone: Element, tag: string): void {
  const attrs = el.attributes;
  for (let i = 0; i < attrs.length; i++) {
    const attr = attrs[i];
    const name = attr.name.toLowerCase();
    if (name.startsWith("on")) continue;
    if (name === "style") {
      const s = sanitizeInlineStyle(attr.value);
      if (s) clone.setAttribute("style", s);
      continue;
    }
    if (name === "class" || name === "id") {
      const v = attr.value.trim();
      if (v.length > 0 && v.length < 2000) clone.setAttribute(attr.name, v);
      continue;
    }
    if (tag === "label" && name === "for") {
      const v = attr.value.trim().slice(0, 200);
      if (v) clone.setAttribute("for", v);
      continue;
    }
    if (tag === "a" && name === "href") {
      const v = attr.value.trim();
      if (v && isAllowedSourceHref(v)) clone.setAttribute("href", v);
      continue;
    }
    if (tag === "img" && name === "src") {
      const v = attr.value.trim();
      if (v && isAllowedImgSrc(v)) clone.setAttribute("src", v);
      continue;
    }
    if (tag === "img" && (name === "alt" || name === "width" || name === "height" || name === "loading")) {
      const v = attr.value.trim().slice(0, 500);
      if (v) clone.setAttribute(attr.name, v);
      continue;
    }
    if (
      (tag === "input" || tag === "button") &&
      (name === "type" ||
        name === "name" ||
        name === "value" ||
        name === "placeholder" ||
        name === "disabled" ||
        name === "readonly" ||
        name === "checked")
    ) {
      const v = attr.value.trim().slice(0, 2000);
      if (v) clone.setAttribute(attr.name, v);
      continue;
    }
    if (tag === "form" && (name === "method" || name === "autocomplete")) {
      const v = attr.value.trim().slice(0, 80);
      if (v) clone.setAttribute(attr.name, v);
      continue;
    }
  }
}

function sanitizeSourceNode(node: Node, doc: Document): Node {
  if (node.nodeType === DOM_NODE_TEXT) {
    return doc.createTextNode(node.textContent ?? "");
  }
  if (node.nodeType === DOM_NODE_COMMENT) {
    return doc.createTextNode("");
  }
  if (node.nodeType !== DOM_NODE_ELEMENT) {
    return doc.createTextNode("");
  }

  const el = node as Element;
  const tag = el.tagName.toLowerCase();

  if (tag === "script" || tag === "style") {
    return doc.createTextNode("");
  }

  if (!ALLOWED_SOURCE_HTML_TAGS.has(tag)) {
    const pre = doc.createElement("pre");
    const code = doc.createElement("code");
    code.className = "rte-preserved-block";
    code.textContent = el.outerHTML;
    pre.appendChild(code);
    return pre;
  }

  if (tag === "a") {
    const href = el.getAttribute("href")?.trim() ?? "";
    if (!href || !isAllowedSourceHref(href)) {
      const frag = doc.createDocumentFragment();
      for (const child of el.childNodes) {
        frag.appendChild(sanitizeSourceNode(child, doc));
      }
      return frag;
    }
    const clone = doc.createElement("a");
    clone.setAttribute("href", href);
    clone.setAttribute("target", "_blank");
    clone.setAttribute("rel", "noopener noreferrer");
    copySafeElementAttributes(el, clone, "a");
    for (const child of el.childNodes) {
      clone.appendChild(sanitizeSourceNode(child, doc));
    }
    return clone;
  }

  if (tag === "img") {
    const src = el.getAttribute("src")?.trim() ?? "";
    if (!src || !isAllowedImgSrc(src)) {
      return doc.createTextNode("");
    }
    const clone = doc.createElement("img");
    clone.setAttribute("src", src);
    copySafeElementAttributes(el, clone, "img");
    return clone;
  }

  if (tag === "br" || tag === "hr") {
    return doc.createElement(tag);
  }

  if (tag === "input") {
    const clone = doc.createElement("input");
    copySafeElementAttributes(el, clone, "input");
    return clone;
  }

  if (tag === "button") {
    const clone = doc.createElement("button");
    copySafeElementAttributes(el, clone, "button");
    for (const child of el.childNodes) {
      clone.appendChild(sanitizeSourceNode(child, doc));
    }
    return clone;
  }

  if (tag === "form") {
    const clone = doc.createElement("form");
    copySafeElementAttributes(el, clone, "form");
    for (const child of el.childNodes) {
      clone.appendChild(sanitizeSourceNode(child, doc));
    }
    return clone;
  }

  const clone = doc.createElement(tag);
  copySafeElementAttributes(el, clone, tag);
  for (const child of el.childNodes) {
    clone.appendChild(sanitizeSourceNode(child, doc));
  }
  return clone;
}

export function sanitizeSourceBodyChildren(body: HTMLElement, doc: Document): void {
  const children = [...body.childNodes];
  body.textContent = "";
  for (const child of children) {
    body.appendChild(sanitizeSourceNode(child, doc));
  }
}

export function prepareSourceHtmlInput(html: string, maxLength: number): string {
  return stripScriptsStylesComments(html.slice(0, maxLength));
}
