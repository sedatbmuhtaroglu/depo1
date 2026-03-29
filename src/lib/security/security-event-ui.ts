const EVENT_TYPE_LABELS: Record<string, string> = {
  TABLE_QR_ENTRY: "QR Menü Girişi",
  CREATE_ORDER: "Sipariş Oluşturma",
  WAITER_CALL: "Garson Çağrısı",
  CANCEL_ORDER: "Sipariş İptali",
  REFUND: "İade",
  PAYMENT_ATTEMPT: "Ödeme Denemesi",
  PAYMENT_SUCCESS: "Ödeme Başarılı",
  PAYMENT_FAILED: "Ödeme Başarısız",
};

const DECISION_LABELS: Record<string, string> = {
  ALLOW: "İzin Verildi",
  BLOCK: "Engellendi",
  REVIEW: "İnceleme Gerekli",
  RATE_LIMIT: "Hız Sınırı Uygulandı",
  AUTO_BLOCK: "Otomatik Engellendi",
};

const RISK_LEVEL_LABELS: Record<"low" | "medium" | "high", string> = {
  low: "Düşük Risk",
  medium: "Orta Risk",
  high: "Yüksek Risk",
};

const KNOWN_ACRONYMS = new Set(["QR", "IP", "ID"]);

function normalizeCode(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function titleCaseToken(token: string): string {
  if (!token) return token;
  if (KNOWN_ACRONYMS.has(token)) return token;
  const lower = token.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function prettifySecurityCode(value: string | null | undefined): string {
  const normalized = normalizeCode(value);
  if (!normalized) return "Bilinmeyen";
  return normalized
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map((token) => titleCaseToken(token))
    .join(" ");
}

export function getSecurityEventTypeLabel(code: string | null | undefined): string {
  const normalized = normalizeCode(code);
  if (!normalized) return "Bilinmeyen Olay";
  return EVENT_TYPE_LABELS[normalized] ?? prettifySecurityCode(normalized);
}

export function getSecurityActionLabel(code: string | null | undefined): string {
  const normalized = normalizeCode(code);
  if (!normalized) return "Bilinmeyen Aksiyon";
  return (
    DECISION_LABELS[normalized] ??
    EVENT_TYPE_LABELS[normalized] ??
    prettifySecurityCode(normalized)
  );
}

export function getSecurityDecisionLabel(code: string | null | undefined): string {
  const normalized = normalizeCode(code);
  if (!normalized) return "Karar Yok";
  return DECISION_LABELS[normalized] ?? prettifySecurityCode(normalized);
}

export function getSecurityReasonLabel(reason: string): string {
  return prettifySecurityCode(reason);
}

export function getRiskLevelLabel(level: "low" | "medium" | "high"): string {
  return RISK_LEVEL_LABELS[level];
}

function parseDate(value: Date | string): Date | null {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function formatSecurityDateCompact(value: Date | string): string {
  const parsed = parseDate(value);
  if (!parsed) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export function formatSecurityDateFull(value: Date | string): string {
  const parsed = parseDate(value);
  if (!parsed) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(parsed);
}

export function formatSecurityTableRef(tableId: number | null, tableNo: number | null): string {
  if (tableNo != null) return `Masa ${tableNo}`;
  if (tableId != null) return `#${tableId}`;
  return "-";
}

