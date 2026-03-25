export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_WAITER_APPROVAL: "Garson Onayı Bekliyor",
  PENDING: "Yeni Sipariş",
  PREPARING: "Hazırlanıyor",
  COMPLETED: "Tamamlandı",
  REJECTED: "Reddedildi",
};

export const ORDER_STATUS_TONE: Record<string, "warning" | "info" | "success" | "danger" | "neutral"> = {
  PENDING_WAITER_APPROVAL: "warning",
  PENDING: "info",
  PREPARING: "info",
  COMPLETED: "success",
  REJECTED: "danger",
};

export const ORDER_PAYMENT_STATUS_LABEL: Record<string, string> = {
  PENDING: "Ödeme Bekliyor",
  INITIATED: "İşlemde",
  PAID: "Ödendi",
  FAILED: "Başarısız",
};

export const ORDER_PAYMENT_STATUS_TONE: Record<string, "warning" | "info" | "success" | "danger" | "neutral"> = {
  PENDING: "warning",
  INITIATED: "info",
  PAID: "success",
  FAILED: "danger",
};

export const ORDER_REFUND_STATUS_LABEL: Record<string, string> = {
  NONE: "-",
  REFUND_PENDING: "İade Bekliyor",
  REFUNDED: "İade Edildi",
  REFUND_FAILED: "İade Başarısız",
};

export const ORDER_REFUND_STATUS_TONE: Record<string, "warning" | "info" | "success" | "danger" | "neutral"> = {
  NONE: "neutral",
  REFUND_PENDING: "warning",
  REFUNDED: "info",
  REFUND_FAILED: "danger",
};

export const WAITER_CALL_STATUS_LABEL: Record<string, string> = {
  PENDING: "Bekliyor",
  ACKNOWLEDGED: "İşleme Alındı",
  RESOLVED: "Çözüldü",
};

export const WAITER_CALL_STATUS_TONE: Record<string, "warning" | "info" | "success" | "danger" | "neutral"> = {
  PENDING: "warning",
  ACKNOWLEDGED: "info",
  RESOLVED: "success",
};

export const BILL_REQUEST_STATUS_LABEL: Record<string, string> = {
  PENDING: "Ödeme Bekleniyor",
  ACKNOWLEDGED: "İşleme Alındı",
  SETTLED: "Tahsil Edildi",
  CANCELED: "İptal Edildi",
};

export const BILL_REQUEST_STATUS_TONE: Record<string, "warning" | "info" | "success" | "danger" | "neutral"> = {
  PENDING: "warning",
  ACKNOWLEDGED: "info",
  SETTLED: "success",
  CANCELED: "danger",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: "Nakit",
  CREDIT_CARD: "Kredi Kartı",
  SODEXO: "Sodexo",
  MULTINET: "Multinet",
  TICKET: "Ticket",
  METROPOL: "Metropol",
};

export const PAYMENT_METHOD_TONE: Record<string, "warning" | "info" | "success" | "danger" | "neutral"> = {
  CASH: "success",
  CREDIT_CARD: "info",
  SODEXO: "warning",
  MULTINET: "warning",
  TICKET: "warning",
  METROPOL: "warning",
};

export const CANCELLATION_REASON_LABEL: Record<string, string> = {
  CUSTOMER_CHANGED_MIND: "Müşteri Vazgeçti",
  OUT_OF_STOCK: "Tükendi",
  WRONG_ITEM: "Hatalı Ürün Seçimi",
  OTHER: "Diğer",
};

export const STAFF_ROLE_LABEL: Record<string, string> = {
  MANAGER: "Restoran Müdürü",
  CASHIER: "Kasiyer",
  WAITER: "Garson",
  KITCHEN: "Mutfak",
};

export const STAFF_ROLE_TONE: Record<string, "warning" | "info" | "success" | "danger" | "neutral"> = {
  MANAGER: "info",
  CASHIER: "success",
  WAITER: "neutral",
  KITCHEN: "warning",
};

export const ACTION_TYPE_LABEL: Record<string, string> = {
  "ORDER_CREATED": "Sipariş Oluşturuldu",
  "ORDER_EDITED": "Sipariş Düzenlendi",
  "ORDER_CANCELLED": "Sipariş İptal Edildi",
  "ORDER_REFUNDED": "Sipariş İade Edildi",
  "PAYMENT_RECEIVED": "Ödeme Alındı",
  "ITEM_CANCELLED": "Ürün İptal Edildi",
  "USER_LOGIN": "Kullanıcı Girişi",
  "USER_CREATED": "Kullanıcı Oluşturuldu",
  "MENU_UPDATED": "Menü Güncellendi",
  "STOCK_UPDATED": "Stok Güncellendi",
  "TABLE_SESSION_ENDED": "Masa Oturumu Kapatıldı",
  "SECURITY_FLAG": "Güvenlik İhlali",
};
