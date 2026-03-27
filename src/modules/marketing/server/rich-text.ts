import { sanitizeSourceHtmlServer } from "@/lib/sanitize-source-html-server";

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

/**
 * Server-side rich HTML sanitization: allowlisted tags + safe links + source-dialog layout tags;
 * disallowed markup is preserved as visible <pre><code class="rte-preserved-block">...</code></pre>.
 * Matches client `sanitizeSourceHtmlClient` / editor extensions for save + preview parity.
 */
export function sanitizeRichTextHtml(input: string | null | undefined, maxLength = 6000): string {
  const normalized = normalizeInput(input ?? "", maxLength);
  if (!normalized) return "";
  return sanitizeSourceHtmlServer(normalized, maxLength);
}
