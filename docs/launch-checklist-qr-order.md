## QR Sipariş Akışı Launch Checklist

Kapsam: QR -> session -> menu -> create order -> PENDING_WAITER_APPROVAL -> waiter approve/reject -> persistent anti-spam -> admin order list.

### 1. Migration ve Prisma

- [ ] `DATABASE_URL` doğru ortama işaret ediyor.
- [ ] Aşağıdaki komut çalıştırıldı ve hata vermedi:
  - `npx prisma migrate deploy` (prod) veya `npx prisma migrate dev` (dev/stage)
- [ ] `20260316194256_add_waiter_approval_enum` migration'ı uygulandı.
- [ ] `20260316194323_set_waiter_approval_default` migration'ı uygulandı.
- [ ] `20260316195145_add_table_session_spam_fields` migration'ı uygulandı.
- [ ] `npx prisma generate` başarıyla çalıştı.

### 2. QR -> Session -> Menu

- [ ] QR (publicCode) okutulduğunda `m/[publicCode]` route'u çalışıyor ve masa bulunuyor.
- [ ] `TableSession` kaydı oluşturuluyor, `sessionToken` cookie olarak set ediliyor.
- [ ] `/[tableId]` ve `/menu/[slug]/[tableId]` sayfaları için:
  - [ ] Geçerli session varken menü ve ürünler listeleniyor.
  - [ ] Session yoksa: “Masa oturumu bulunamadı. Lütfen masadaki QR kodu tekrar okutun.” mesajı geliyor.

### 3. Normal Sipariş Akışı

- [ ] Müşteri menüden ürün seçip sepeti gönderdiğinde `createOrder` aksiyonu başarılı.
- [ ] Sipariş oluşturulduktan sonra `order-success/[orderId]` sayfasına yönleniyor.
- [ ] Success sayfasında:
  - [ ] Sipariş numarası ve masa numarası doğru görünüyor.
  - [ ] Toplam tutar doğru.
  - [ ] Yeni oluşturulan sipariş için durum metni: “Siparişiniz garson onayına gönderildi. Garson onayladıktan sonra hazırlanmaya başlanacaktır.”

### 4. Persistent Anti-Spam Kontrolü

- [ ] Aynı masadan ilk siparişten 2–5 saniye sonra tekrar sipariş denenince:
  - [ ] Aksiyon reddediliyor.
  - [ ] Mesaj: “Çok kısa sürede tekrar sipariş gönderildi. Lütfen birkaç saniye bekleyin.”
- [ ] Aynı masadan 15 saniyelik cooldown'ı ihlal ederek çok sayıda deneme yapılınca:
  - [ ] Geçici blok devreye giriyor.
  - [ ] Mesaj: “Bu masa için geçici bir güvenlik kısıtı uygulandı. Lütfen garsona başvurun.”
  - [ ] `TableSession` kaydında `blockedUntil` ileri bir zamanı gösteriyor.
- [ ] Blok süresi dolduktan sonra:
  - [ ] Yeni sipariş normal şekilde alınabiliyor.
  - [ ] Anti-spam mesajı gelmiyor.

### 5. Waiter Approve / Reject

- [ ] Admin / mutfak paneli açılıyor ve siparişler listeleniyor.
- [ ] Yeni bir sipariş ilk etapta “Onay Bekleyen Siparişler” alanında:
  - [ ] Status badge’i sarı tonda ve “Garson Onayı Bekliyor” metniyle görünüyor.
- [ ] “Onayla” ile sipariş `PENDING` durumuna alındığında:
  - [ ] Toast: “Sipariş #ID durumu güncellendi.”
  - [ ] Sipariş mutfak listesine “Bekliyor” badge’i ile taşınıyor.
- [ ] “Reddet” ile sipariş `REJECTED` durumuna alındığında:
  - [ ] Toast: “Sipariş #ID durumu güncellendi.”
  - [ ] İlgili kartta **kırmızı** tonda “Reddedildi” badge’i görünüyor (başarı rengiyle karışmıyor).

### 6. Session Edge Case'leri

- [ ] Session süresi dolduktan sonra:
  - [ ] Menü sayfası: “Masa oturumu bulunamadı. Lütfen masadaki QR kodu tekrar okutun.” mesajını gösteriyor.
  - [ ] `createOrder` denemesi session hatasıyla (masa oturumu bulunamadı / geçersiz) kullanıcı dostu mesaj döndürüyor.
  - [ ] Anti-spam mesajları bu durumda devreye girmiyor (önce session guard çalışıyor).
- [ ] Yanlış masa ID'si veya farklı tenant'ın masası ile istek atıldığında:
  - [ ] Uygun “masa / tenant uyumsuzluğu” mesajı dönüyor.
  - [ ] Admin paneline hatalı bir sipariş düşmüyor.

### 7. Admin Paneli Durum Görünümleri

- [ ] Status sıralaması beklendiği gibi:
  - [ ] `PENDING_WAITER_APPROVAL` en önde.
  - [ ] `PENDING` / `PREPARING` aktif siparişler ortada.
  - [ ] `COMPLETED` ve `REJECTED` en sonda.
- [ ] Badge renkleri:
  - [ ] `PENDING_WAITER_APPROVAL`: sarı.
  - [ ] `PENDING`: sarı.
  - [ ] `PREPARING`: mavi.
  - [ ] `COMPLETED`: yeşil.
  - [ ] `REJECTED`: kırmızı.

### 8. Build / Lint

- [ ] `npm run lint` (veya proje komutuna göre eşdeğer) başarıyla tamamlandı.
- [ ] `npm run build` başarıyla tamamlandı.

