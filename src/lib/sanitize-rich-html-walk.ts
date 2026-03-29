import { DOM_NODE_COMMENT, DOM_NODE_ELEMENT, DOM_NODE_TEXT } from "@/lib/dom-node-types";

/**
 * Shared allowlist + DOM tree walk for rich HTML sanitization.
 * Disallowed tags are preserved as visible <pre><code class="rte-preserved-block">...</code></pre>
 * (raw HTML as text — not executed). Script/style are removed before parsing.
 */

export const ALLOWED_RICH_HTML_TAGS = new Set([
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
]);

export function isAllowedRichHref(value: string): boolean {
  return (
    value.startsWith("/") ||
    value.startsWith("#") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("mailto:") ||
    value.startsWith("tel:")
  );
}

/** Remove executable / noisy blocks before parsing (no full sanitize yet). */
export function stripScriptsStylesComments(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}

/** True if clipboard HTML contains any tag not in the allowlist (paste → code block). */
export function hasDisallowedRichHtmlTags(html: string): boolean {
  const re = /<([a-z0-9]+)(?:\s|>|\/)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const t = m[1].toLowerCase();
    if (!ALLOWED_RICH_HTML_TAGS.has(t)) return true;
  }
  return false;
}

function sanitizeNode(node: Node, doc: Document): Node {
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

  if (!ALLOWED_RICH_HTML_TAGS.has(tag)) {
    const pre = doc.createElement("pre");
    const code = doc.createElement("code");
    code.className = "rte-preserved-block";
    code.textContent = el.outerHTML;
    pre.appendChild(code);
    return pre;
  }

  if (tag === "a") {
    const href = el.getAttribute("href")?.trim() ?? "";
    if (!href || !isAllowedRichHref(href)) {
      const frag = doc.createDocumentFragment();
      for (const child of el.childNodes) {
        frag.appendChild(sanitizeNode(child, doc));
      }
      return frag;
    }
    const clone = doc.createElement("a");
    clone.setAttribute("href", href);
    clone.setAttribute("target", "_blank");
    clone.setAttribute("rel", "noopener noreferrer");
    for (const child of el.childNodes) {
      clone.appendChild(sanitizeNode(child, doc));
    }
    return clone;
  }

  if (tag === "br" || tag === "hr") {
    return doc.createElement(tag);
  }

  const clone = doc.createElement(tag);
  for (const child of el.childNodes) {
    clone.appendChild(sanitizeNode(child, doc));
  }
  return clone;
}

export function sanitizeBodyChildren(body: HTMLElement, doc: Document): void {
  const children = [...body.childNodes];
  body.textContent = "";
  for (const child of children) {
    body.appendChild(sanitizeNode(child, doc));
  }
}
