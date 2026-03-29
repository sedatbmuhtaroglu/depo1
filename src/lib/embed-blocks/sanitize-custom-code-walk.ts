import { DOM_NODE_COMMENT, DOM_NODE_ELEMENT, DOM_NODE_TEXT } from "@/lib/dom-node-types";
import { isAllowedRichHref, stripScriptsStylesComments } from "@/lib/sanitize-rich-html-walk";

/** Static markup for Custom Code blocks — no script, iframe, form, embed, object. */
export const ALLOWED_CUSTOM_CODE_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "ul",
  "ol",
  "li",
  "a",
  "h1",
  "h2",
  "h3",
  "h4",
  "blockquote",
  "pre",
  "code",
  "hr",
  "div",
  "span",
  "section",
  "article",
  "figure",
  "figcaption",
  "img",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "th",
  "td",
  "caption",
  "small",
  "sub",
  "sup",
]);

function isAllowedImgSrc(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (v.startsWith("/")) return true;
  return isAllowedRichHref(v);
}

export function findDisallowedCustomCodeTag(body: HTMLElement): string | null {
  const all = body.querySelectorAll("*");
  for (const el of all) {
    const t = el.tagName.toLowerCase();
    if (!ALLOWED_CUSTOM_CODE_TAGS.has(t)) return t;
  }
  return null;
}

function sanitizeCustomCodeNode(node: Node, doc: Document): Node {
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

  if (!ALLOWED_CUSTOM_CODE_TAGS.has(tag)) {
    const frag = doc.createDocumentFragment();
    for (const child of el.childNodes) {
      frag.appendChild(sanitizeCustomCodeNode(child, doc));
    }
    return frag;
  }

  if (tag === "a") {
    const href = el.getAttribute("href")?.trim() ?? "";
    if (!href || !isAllowedRichHref(href)) {
      const frag = doc.createDocumentFragment();
      for (const child of el.childNodes) {
        frag.appendChild(sanitizeCustomCodeNode(child, doc));
      }
      return frag;
    }
    const clone = doc.createElement("a");
    clone.setAttribute("href", href);
    clone.setAttribute("target", "_blank");
    clone.setAttribute("rel", "noopener noreferrer");
    const cls = el.getAttribute("class");
    if (cls && cls.length < 2000) clone.setAttribute("class", cls);
    for (const child of el.childNodes) {
      clone.appendChild(sanitizeCustomCodeNode(child, doc));
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
    const alt = el.getAttribute("alt") ?? "";
    clone.setAttribute("alt", alt.slice(0, 500));
    for (const attr of ["width", "height", "class", "loading", "decoding"] as const) {
      const v = el.getAttribute(attr);
      if (v != null && v.length < 2000) clone.setAttribute(attr, v);
    }
    return clone;
  }

  if (tag === "br" || tag === "hr") {
    return doc.createElement(tag);
  }

  if (tag === "th" || tag === "td") {
    const clone = doc.createElement(tag);
    const cls = el.getAttribute("class");
    if (cls && cls.length < 2000) clone.setAttribute("class", cls);
    for (const attr of ["colspan", "rowspan", "scope"] as const) {
      const v = el.getAttribute(attr);
      if (v != null && v.length < 20) clone.setAttribute(attr, v);
    }
    for (const child of el.childNodes) {
      clone.appendChild(sanitizeCustomCodeNode(child, doc));
    }
    return clone;
  }

  const clone = doc.createElement(tag);
  const cls = el.getAttribute("class");
  if (cls && cls.length < 2000) clone.setAttribute("class", cls);

  for (const child of el.childNodes) {
    clone.appendChild(sanitizeCustomCodeNode(child, doc));
  }
  return clone;
}

export function sanitizeCustomCodeBody(body: HTMLElement, doc: Document): void {
  const children = [...body.childNodes];
  body.textContent = "";
  for (const child of children) {
    body.appendChild(sanitizeCustomCodeNode(child, doc));
  }
}
