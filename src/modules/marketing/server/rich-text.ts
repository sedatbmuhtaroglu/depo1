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
  const decodedNamed = value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&ccedil;/gi, "ç")
    .replace(/&Ccedil;/g, "Ç")
    .replace(/&uuml;/gi, "ü")
    .replace(/&Uuml;/g, "Ü")
    .replace(/&ouml;/gi, "ö")
    .replace(/&Ouml;/g, "Ö")
    .replace(/&iacute;/gi, "í")
    .replace(/&Iacute;/g, "Í")
    .replace(/&iuml;/gi, "ï")
    .replace(/&Iuml;/g, "Ï")
    .replace(/&acirc;/gi, "â")
    .replace(/&Acirc;/g, "Â")
    .replace(/&icirc;/gi, "î")
    .replace(/&Icirc;/g, "Î")
    .replace(/&ucirc;/gi, "û")
    .replace(/&Ucirc;/g, "Û")
    .replace(/&eacute;/gi, "é")
    .replace(/&Eacute;/g, "É")
    .replace(/&aacute;/gi, "á")
    .replace(/&Aacute;/g, "Á")
    .replace(/&igrave;/gi, "ì")
    .replace(/&Igrave;/g, "Ì")
    .replace(/&copy;/gi, "©")
    .replace(/&reg;/gi, "®");

  return decodedNamed
    .replace(/&#(\d+);/g, (_, code: string) => {
      const value = Number.parseInt(code, 10);
      if (!Number.isFinite(value)) return _;
      return String.fromCodePoint(value);
    })
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => {
      const value = Number.parseInt(code, 16);
      if (!Number.isFinite(value)) return _;
      return String.fromCodePoint(value);
    });
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
