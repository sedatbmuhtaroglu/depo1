type UnknownRecord = Record<string, unknown>;

type AuditRecordLike = {
  actionType: string;
  entityType?: string | null;
  entityId?: string | null;
  description?: string | null;
};

const FALLBACK_DESCRIPTION = "İşlem kaydı oluşturuldu.";

const ACTION_LABELS: Record<string, string> = {
  ORDER_STATUS: "Sipariş durumu güncellendi",
  ORDER_DELIVERED: "Sipariş teslim edildi",
  ORDER_MANUAL_CREATE: "Manuel sipariş oluşturuldu",
  ORDER_ITEM_CANCEL: "Sipariş kalemi iptal edildi",
  ORDER_CASH_ADJUST: "Nakit sipariş düzeltmesi yapıldı",
  WAITER_CALL_STATUS: "Garson çağrısı güncellendi",
  BILL_REQUEST_STATUS: "Hesap isteği güncellendi",
  BILL_SETTLED: "Hesap tahsil edilip kapatıldı",
  TABLE_PAYMENT: "Masa ödemesi alındı",
  TABLE_CREATE: "Masa oluşturuldu",
  TABLE_OPEN: "Masa açıldı",
  TABLE_CLOSE: "Masa kapatıldı",
  SETTINGS_UPDATE: "Ayarlar güncellendi",
  RESTAURANT_SETTINGS: "Restoran ayarları güncellendi",
  DOMAIN_ADD: "Alan adı eklendi",
  DOMAIN_REMOVE: "Alan adı kaldırıldı",
  STAFF_CREATE: "Personel hesabı oluşturuldu",
  CATEGORY_CREATE: "Kategori oluşturuldu",
  CATEGORY_UPDATE: "Kategori güncellendi",
  CATEGORY_DELETE: "Kategori silindi",
  PRODUCT_CREATE: "Ürün oluşturuldu",
  PRODUCT_UPDATE: "Ürün güncellendi",
  PRODUCT_DELETE: "Ürün silindi",
  PRODUCT_BULK_PRICE: "Toplu fiyat güncellemesi yapıldı",
  PRODUCT_STOCK_UPDATE: "Ürün stoğu güncellendi",
  TABLE_ACCOUNT_TRANSFER_FULL: "Masa hesabı taşındı",
  TABLE_ACCOUNT_MERGE: "Masa hesapları birleştirildi",
  TABLE_ACCOUNT_TRANSFER_PARTIAL: "Masa hesabından kalem taşındı",
  support_session_started: "Destek oturumu başlatıldı",
  support_session_entered: "Destek ekibi panele giriş yaptı",
  support_session_exited: "Destek oturumu sonlandırıldı",
  support_session_revoked_or_expired: "Destek oturumu kapandı",
};

const TARGET_LABELS: Record<string, string> = {
  Order: "Sipariş",
  Table: "Masa",
  Category: "Kategori",
  Product: "Ürün",
  BillRequest: "Hesap isteği",
  TenantStaff: "Personel",
  TenantDomain: "Alan adı",
  TenantPaymentConfig: "Ödeme ayarı",
  Restaurant: "Restoran",
  WaiterCall: "Garson çağrısı",
  SecurityEvent: "Güvenlik kaydı",
  supportImpersonationSession: "Destek erişimi",
};

function getNumberField(input: unknown): number | null {
  return typeof input === "number" && Number.isFinite(input) ? input : null;
}

function getStringField(input: unknown): string | null {
  return typeof input === "string" && input.trim().length > 0 ? input.trim() : null;
}

function tryParseDescriptionPayload(description?: string | null): UnknownRecord | null {
  const raw = description?.trim();
  if (!raw) return null;
  if (!raw.startsWith("{") || !raw.endsWith("}")) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as UnknownRecord;
    }
    return null;
  } catch {
    return null;
  }
}

function asSentence(label: string): string {
  return label.endsWith(".") ? label : `${label}.`;
}

function formatSupportDescription(record: AuditRecordLike): string | null {
  const payload = tryParseDescriptionPayload(record.description);

  if (record.actionType === "support_session_started") {
    const reason = getStringField(payload?.reason);
    const duration = getNumberField(payload?.duration);
    if (reason && duration) {
      return `Destek ekibi, "${reason}" nedeniyle ${duration} dakikalık erişim başlattı.`;
    }
    if (reason) {
      return `Destek ekibi, "${reason}" nedeniyle destek erişimi başlattı.`;
    }
    return "Destek oturumu başlatıldı.";
  }

  if (record.actionType === "support_session_entered") {
    return "Destek ekibi panele giriş yaptı.";
  }

  if (record.actionType === "support_session_exited") {
    const outcome = getStringField(payload?.outcome);
    if (outcome === "user_exit") return "Destek oturumu kullanıcı tarafından sonlandırıldı.";
    if (outcome === "admin_revoke") return "Destek oturumu yönetim tarafından sonlandırıldı.";
    return "Destek oturumu sonlandırıldı.";
  }

  if (record.actionType === "support_session_revoked_or_expired") {
    const reason = getStringField(payload?.reason);
    if (reason === "expired") {
      return "Destek oturumu süresi dolduğu için kapandı.";
    }
    return "Destek oturumu sonlandırıldığı için kapandı.";
  }

  return null;
}

export function formatAuditActionLabel(action: string, metadata?: UnknownRecord): string {
  void metadata;
  const trimmed = action.trim();
  if (!trimmed) return "İşlem kaydı";
  return ACTION_LABELS[trimmed] ?? ACTION_LABELS[trimmed.toUpperCase()] ?? "İşlem kaydı";
}

export function formatAuditTargetLabel(targetType?: string | null, targetLabel?: string | null): string {
  void targetLabel;
  const trimmed = targetType?.trim();
  if (!trimmed) return "Genel kayıt";
  return TARGET_LABELS[trimmed] ?? "Genel kayıt";
}

export function formatAuditDescription(record: AuditRecordLike): string {
  const supportDescription = formatSupportDescription(record);
  if (supportDescription) return supportDescription;

  // JSON payload varsa son kullanıcıya ham teknik veri göstermeyiz.
  const payload = tryParseDescriptionPayload(record.description);
  if (payload) {
    const actionLabel = formatAuditActionLabel(record.actionType);
    return asSentence(actionLabel);
  }

  if (!record.description?.trim()) {
    const actionLabel = formatAuditActionLabel(record.actionType);
    return actionLabel === "İşlem kaydı" ? FALLBACK_DESCRIPTION : asSentence(actionLabel);
  }

  // Açıklama parse edilemiyorsa güvenli fallback.
  return FALLBACK_DESCRIPTION;
}
