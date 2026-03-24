# Faz 2 – Yol Haritası

Faz 1 (pilot/satış hazırlığı) tamamlandı. Faz 2, canlı kullanım ve ölçeklemeye yönelik geliştirmeleri kapsar.

---

## 1. Ödeme ve kasa

| Madde | Açıklama | Öncelik |
|-------|----------|--------|
| Ödeme gateway | iyzico / PayTR / Stripe entegrasyonu (Plan bazlı: hangi tenant hangi gateway) | Yüksek |
| Fiş / yazıcı | Hesap kapatıldığında fiş yazdırma (thermal printer API veya PDF indir) | Orta |
| Taksit / kupon | Kredi kartı taksit seçenekleri, indirim kuponu (masa/sipariş bazlı) | Düşük |

---

## 2. Bildirimler

| Madde | Açıklama | Öncelik |
|-------|----------|--------|
| Push / Web Push | Yeni sipariş, garson çağrısı, sipariş hazır için tarayıcı bildirimi | Yüksek |
| Ses / titreşim | Mutfak ve garson panelinde yeni olayda ses/titreşim | Orta |
| E-posta / SMS | Özet rapor (günlük), büyük sipariş uyarısı (isteğe bağlı) | Düşük |

---

## 3. Raporlama ve dışa aktarma

| Madde | Açıklama | Öncelik |
|-------|----------|--------|
| PDF rapor | Günlük/haftalık satış özeti, ödeme kırılımı, tek tıkla PDF indir | Yüksek |
| Excel/CSV export | Sipariş listesi, performans, garson çağrıları tarih aralığıyla export | Orta |
| Dashboard özeti | Müdür ana sayfada “bugünkü ciro”, “açık masa”, “bekleyen sipariş” kartları | Orta |

---

## 4. Domain ve marka

| Madde | Açıklama | Öncelik |
|-------|----------|--------|
| Custom domain | Kurumsal pakette gerçek domain bağlama (CNAME + SSL), subdomain yönetimi | Yüksek |
| White-label | Logo, renk, “Powered by MENUCY” gizleme (plan bazlı) | Düşük |

---

## 5. Mobil ve PWA

| Madde | Açıklama | Öncelik |
|-------|----------|--------|
| PWA install | “Uygulamaya ekle” prompt, offline menü önbelleği | Orta |
| Mobil UX | Masa/menü ekranlarında dokunma ve hız iyileştirmeleri | Orta |

---

## 6. Entegrasyonlar

| Madde | Açıklama | Öncelik |
|-------|----------|--------|
| Webhook | Sipariş oluştu / hesap kapandı için dış sistemlere HTTP webhook | Orta |
| API (read) | Harici POS/kasa için sipariş ve masa durumu okuma API’si | Düşük |

---

## 7. İşletme ve ürün

| Madde | Açıklama | Öncelik |
|-------|----------|--------|
| Çok dil | Menü ve arayüz dili (TR/EN) – schema’da `Language` mevcut, UI’a taşınması | Orta |
| Stok / tükendi | Ürün “stok yok” veya “tükendi” işaretleme, menüde gizleme veya pasif gösterme | Düşük |
| Plan / fiyatlandırma UI | Admin’de plan değiştirme, limitler (masa sayısı, sipariş vb.) | Düşük |

---

## Önerilen sıra (ilk 3–6 ay)

1. **Ödeme gateway** – Tahsilat için kritik.
2. **Bildirimler (push/ses)** – Garson ve mutfak deneyimi.
3. **PDF rapor + dashboard özeti** – İşletme sahibi için değer.
4. **Custom domain** – Kurumsal satış için gerekli.
5. **PWA / mobil UX** – Müşteri tarafı menü deneyimi.

---

## Not

- Faz 2’de **yeni özellik** odaklı; Faz 1’deki güvenlik, audit ve rol yapısı korunur.
- Her madde için ayrı task listesi ve tahmini süre sonradan eklenebilir.
