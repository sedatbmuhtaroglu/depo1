const TURKISH_MAP: Record<string, string> = {
  "Ã§": "c",
  "Ã‡": "c",
  "ÄŸ": "g",
  "Ä": "g",
  "Ä±": "i",
  "Ä°": "i",
  "Ã¶": "o",
  "Ã–": "o",
  "ÅŸ": "s",
  "Å": "s",
  "Ã¼": "u",
  "Ãœ": "u",
};

function replaceTurkishChars(value: string): string {
  return value.replace(/[Ã§Ã‡ÄŸÄÄ±Ä°Ã¶Ã–ÅŸÅÃ¼Ãœ]/g, (char) => TURKISH_MAP[char] ?? char);
}

export function slugify(value: string): string {
  const normalized = replaceTurkishChars(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized.slice(0, 160);
}

export function normalizeSlugInput(value: string, fallbackPrefix: string): string {
  const slug = slugify(value);
  if (slug.length > 0) return slug;
  return `${fallbackPrefix}-${Date.now().toString().slice(-6)}`;
}

