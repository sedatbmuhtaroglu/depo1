const SAFE_RICH_TEXT_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "ul",
  "ol",
  "li",
  "a",
]);

function normalizeInput(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

export function plainTextToRichHtml(value: string | null | undefined): string {
  const normalized = (value ?? "").trim();
  if (!normalized) return "";

  const paragraphs = normalized
    .split(/\r?\n\r?\n/g)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\r?\n/g, "<br>")}</p>`);

  if (paragraphs.length === 0) return "";
  return paragraphs.join("");
}

function isAllowedHref(value: string): boolean {
  return (
    value.startsWith("/") ||
    value.startsWith("#") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("mailto:") ||
    value.startsWith("tel:")
  );
}

function sanitizeAnchorTagAttributes(rawAttributes: string): string {
  const hrefMatch = rawAttributes.match(/href\s*=\s*([\"'])(.*?)\1/i);
  const hrefValue = hrefMatch ? hrefMatch[2].trim() : "";

  if (!hrefValue || !isAllowedHref(hrefValue)) {
    return "";
  }

  return ` href=\"${escapeHtml(hrefValue)}\" target=\"_blank\" rel=\"noopener noreferrer\"`;
}

export function sanitizeRichTextHtml(input: string | null | undefined, maxLength = 6000): string {
  const normalized = normalizeInput(input ?? "", maxLength);
  if (!normalized) return "";

  const withoutScript = normalized
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--([\s\S]*?)-->/g, "");

  const sanitized = withoutScript.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (fullMatch, rawTag, rawAttributes) => {
    const tag = String(rawTag).toLowerCase();
    const isClosing = fullMatch.startsWith("</");

    if (!SAFE_RICH_TEXT_TAGS.has(tag)) {
      return "";
    }

    if (isClosing) {
      return `</${tag}>`;
    }

    if (tag === "br") {
      return "<br>";
    }

    if (tag === "a") {
      return `<a${sanitizeAnchorTagAttributes(String(rawAttributes ?? ""))}>`;
    }

    return `<${tag}>`;
  });

  return sanitized.trim();
}
