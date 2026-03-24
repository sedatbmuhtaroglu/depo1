# Ödeme Gateway (iyzico)

Kart ile ödeme, **iyzico** Checkout Form ile entegre edilmiştir. Garson panelinde “Ödeme Al / Kapat” → “Kredi Kartı” seçilip **“Kart ile öde (iyzico)”** denince iyzico ödeme sayfasına yönlendirilir; ödeme başarılı olunca hesap otomatik kapatılır.

## Ortam değişkenleri

`.env` dosyasına ekleyin:

```env
# iyzico (opsiyonel – yoksa “Kart ile öde” butonu görünmez, sadece nakit/diğer kayıt)
IYZIPAY_API_KEY=your_api_key
IYZIPAY_SECRET_KEY=your_secret_key

# Sandbox: varsayılan (NODE_ENV !== production). Canlı: https://api.iyzipay.com
# IYZIPAY_URI=https://sandbox-api.iyzipay.com

# Callback URL için (iyzico ödeme sonrası dönüş). Yoksa localhost kullanılır.
APP_URL=https://your-domain.com
```

- **IYZIPAY_API_KEY** / **IYZIPAY_SECRET_KEY**: iyzico panelinden alınır (sandbox veya canlı).
- **IYZIPAY_URI**: Belirtmezseniz geliştirmede sandbox, production’da canlı API kullanılır.
- **APP_URL**: Ödeme sonrası garson sayfasına yönlendirme için (HTTPS önerilir).

## Akış

1. Garson: Hesap isteği → “Ödeme Al / Kapat” → Tutar + “Kredi Kartı” → **“Kart ile öde (iyzico)”**.
2. Uygulama: iyzico Checkout Form initialize → `PaymentIntent` (PENDING) kaydı → kullanıcı `paymentPageUrl`’e yönlendirilir.
3. Müşteri: iyzico sayfasında kart bilgisi girer, ödemeyi tamamlar.
4. iyzico: Callback URL’e yönlendirir (`/api/payment/iyzico/callback?token=...`).
5. Uygulama: Token ile CF-Retrieve → `paymentStatus === SUCCESS` ise `completeGatewaySettlement` (hesap kapatma, masa kapatma, Payment + audit).
6. Kullanıcı: `/waiter?payment=success` veya `payment=failed` ile garson sayfasına döner; toast gösterilir.

## Veritabanı

- **PaymentIntent**: `gatewayToken`, `billRequestId`, `amount`, `status` (PENDING/SUCCESS/FAILED).
- **Payment**: `gatewayProvider: IYZICO`, `gatewayPaymentId` (iyzico paymentId) – kart ödemelerinde doldurulur.

## Raporlar

Kart ile kapatılan hesaplar “Kredi Kartı” ödeme yöntemiyle raporlarda görünür; `Payment.gatewayProvider` ve `gatewayPaymentId` ile iyzico tarafında eşleme yapılabilir.

## İleride (Faz 2+)

- Restoran ayarlarında tenant bazlı API key (şu an tüm tenant’lar aynı env değişkenlerini kullanır).
- Fiş / makbuz, iade (refund) entegrasyonu.
