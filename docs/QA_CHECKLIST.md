# Canlı Öncesi Manuel Test Listesi

## 1. Rol bazlı erişim
- [ ] **glidra** (MANAGER) ile giriş → /restaurant açılır, tüm menüler görünür.
- [ ] **waiter1** (WAITER) ile giriş → /restaurant’a gidince /waiter’a yönlendirilir; sadece garson menüsü.
- [ ] **kitchen1** (KITCHEN) ile giriş → /restaurant veya /waiter’a gidince /kitchen’a yönlendirilir.
- [ ] TenantStaff kaydı olmayan bir admin kullanıcı (sadece AdminUser’da) → MANAGER kabul edilir, /restaurant erişir.

## 2. Personel performans verisi
- [ ] Müdür paneli → Personel Performansı: Tarih aralığı seç, WAITER rolündeki personel listelenir; baktığı masa, teslim ettiği sipariş, ort. teslim/hesap/çağrı süreleri dolu mu?
- [ ] Garson paneli → “Benim performansım (son 7 gün)” kartı sadece TenantStaff ile giriş yapılmışsa görünür; teslim adedi ve ortalama yanıt süreleri dolu mu?

## 3. Garson çağırma logları
- [ ] Müdür paneli → Garson Çağırma Logları: Tarih aralığı, masa, durum filtreleri çalışıyor mu?
- [ ] Çağrı zamanı, yanıt zamanı, “kaç dakikada yanıtlandı”, durum, ilgilenen personel sütunları doğru mu?
- [ ] Aynı masadan kısa sürede çok çağrı varsa “Çok çağrı” badge’i görünüyor mu?

## 4. Hesap vazgeçildi akışı
- [ ] Müşteri hesap isteği gönderir → Garson “Hesap Alındı” veya “Vazgeçildi” seçebiliyor mu?
- [ ] Vazgeçildi seçilince ilgili BillRequest durumu CANCELED oluyor mu ve loglarda görünüyor mu?

## 5. Settlement kayıtları rapora düşüyor mu
- [ ] Garson “Ödeme Al” ile ödeme yöntemi + tutar girip kapatıyor.
- [ ] Raporlar sayfasında seçilen tarih aralığında toplam tahsilat ve ödeme yöntemine göre kırılım doğru mu?

## 6. Mutfak eşik ayarı
- [ ] Ayarlar → Mutfak bekleme eşikleri: Sarı / Turuncu / Kırmızı dakikaları değiştir, kaydet.
- [ ] Mutfak panelinde sipariş kartları bekleyen/hazırlanan süreye göre sarı/turuncu/kırmızı renge geçiyor mu?
- [ ] Ayarlar boş/veri yokken varsayılan 5/10/15 dakika kullanılıyor mu?

## 7. Audit log
- [ ] Masa aç/kapat, hesap alındı/vazgeçildi, manuel sipariş, sipariş iptali, ürün/kategori CRUD, ayar değişikliği yap.
- [ ] Müdür paneli → İşlem Geçmişi: Tarih ve işlem tipi filtreleriyle bu kayıtlar listeleniyor mu?

## 8. Seed sonrası demo tenant
- [ ] `npx prisma db seed` çalıştır.
- [ ] Giriş: **glidra** / **waiter1** / **kitchen1**, şifre: **12345678**.
- [ ] Dev ortamında x-tenant-slug yoksa ilk tenant kullanılır; müdür/garson/mutfak panelleri açılıyor mu?
- [ ] Örnek masalar, kategoriler, ürünler ve bir demo sipariş oluştu mu?

## 9. Genel
- [ ] Mevcut sipariş/masa/hesap/mutfak akışları bozulmadan çalışıyor mu?
- [ ] Multi-tenant: Farklı tenant’a ait veriye erişim engelli mi (server action’larda tenantId kontrolü)?
