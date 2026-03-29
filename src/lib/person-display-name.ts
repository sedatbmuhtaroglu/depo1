/**
 * Tek standart: personel / panel için ekranda gösterilecek ad soyad çözümlemesi.
 * UTF-8 ile uyumlu; Türkçe locale kullanır; kullanıcı adı ve e-posta fallback'lerini bozmaz.
 */

export type PersonNameParts = {
  fullName?: string | null;
  name?: string | null;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
  email?: string | null;
};

/** TenantStaff / benzeri kayıtlar için kısayol */
export type StaffNameFields = {
  displayName: string | null;
  username: string;
};

/**
 * Latin-1 olarak yanlış okunmuş yaygın UTF-8 dizileri (güvenli, küçük tablo).
 * Bilinmeyen bozulmalar için orijinal korunur.
 */
const MOJIBAKE_FIXES: Array<[RegExp, string]> = [
  [/Ã¼/g, "ü"],
  [/Ãœ/g, "Ü"],
  [/Ã¶/g, "ö"],
  [/Ã–/g, "Ö"],
  [/Ã§/g, "ç"],
  [/Ã‡/g, "Ç"],
  [/Ä±/g, "ı"],
  [/Ä°/g, "İ"],
  [/Å\u009f/g, "ş"],
  [/Å\u009e/g, "Ş"],
  [/ÄŸ/g, "ğ"],
  [/Ä\u009e/g, "Ğ"],
  [/Ã¢/g, "â"],
  [/Ã®/g, "î"],
  [/Ã»/g, "û"],
];

export function tryRepairUtf8Mojibake(input: string): string {
  let s = input;
  for (const [re, rep] of MOJIBAKE_FIXES) {
    s = s.replace(re, rep);
  }
  return s;
}

export function normalizeDisplayWhitespace(input: string): string {
  return tryRepairUtf8Mojibake(input).replace(/\s+/g, " ").trim();
}

function isLikelyEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(s);
}

/** Aşırı UPPER / lower tam isimleri makul başlık düzenine çeker; karışık yazımı korur. */
function shouldNormalizeNameCasing(s: string): boolean {
  const letters = s.replace(/[^\p{L}]/gu, "");
  if (letters.length < 2) return false;
  return letters === letters.toUpperCase() || letters === letters.toLowerCase();
}

function titleCaseWordTr(word: string): string {
  if (!word) return word;
  const lower = word.toLocaleLowerCase("tr-TR");
  const first = lower.charAt(0).toLocaleUpperCase("tr-TR");
  return first + lower.slice(1);
}

export function formatHumanNameForUi(raw: string): string {
  const n = normalizeDisplayWhitespace(raw);
  if (!n) return n;
  if (isLikelyEmail(n)) return n;
  if (!shouldNormalizeNameCasing(n)) return n;
  return n
    .split(/\s+/)
    .filter(Boolean)
    .map(titleCaseWordTr)
    .join(" ");
}

/**
 * Öncelik: fullName / name / displayName → first+last → tek first/last → username → email
 * İnsan adı adayları başlık düzenlenir; kullanıcı adı ve e-posta sadece trim/boşluk/mojibake düzeltmesi alır.
 */
export function resolvePersonDisplayName(parts: PersonNameParts): string {
  const firstLast =
    parts.firstName?.trim() && parts.lastName?.trim()
      ? `${parts.firstName!.trim()} ${parts.lastName!.trim()}`
      : null;
  const singleFirstOrLast = parts.firstName?.trim() || parts.lastName?.trim() || null;

  const humanCandidates: Array<string | null | undefined> = [
    parts.fullName,
    parts.name,
    parts.displayName,
    firstLast,
    singleFirstOrLast,
  ];

  for (const c of humanCandidates) {
    if (c == null) continue;
    const n = normalizeDisplayWhitespace(String(c));
    if (!n) continue;
    return formatHumanNameForUi(n);
  }

  const loginCandidates: Array<string | null | undefined> = [parts.username, parts.email];
  for (const c of loginCandidates) {
    if (c == null) continue;
    const n = normalizeDisplayWhitespace(String(c));
    if (!n) continue;
    return n;
  }

  return "";
}

/** TenantStaff satırı için tek giriş noktası */
export function formatStaffDisplayName(staff: StaffNameFields): string {
  const r = resolvePersonDisplayName({
    displayName: staff.displayName,
    username: staff.username,
  });
  if (r) return r;
  return normalizeDisplayWhitespace(staff.username);
}
