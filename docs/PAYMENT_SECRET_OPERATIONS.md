# Payment Secret Operations

Amaç: `TenantPaymentConfig.secretKey` alanında plaintext/legacy kayıt kalmadığını güvenli şekilde yönetmek.

## Önerilen sıra

1. **Dry-run (tespit)**
   - `npm run secrets:backfill`
   - İsteğe bağlı tenant filtreli:
   - `npm run secrets:backfill -- --tenant-id=123`

2. **Write (dönüştürme)**
   - Önce geçerli encryption key tanımlayın:
   - `TENANT_PAYMENT_SECRET_KEY=<32-byte-hex-or-base64>`
   - Sonra yazma:
   - `npm run secrets:backfill:write`
   - İsteğe bağlı tenant filtreli:
   - `npm run secrets:backfill:write -- --tenant-id=123`

3. **Verify (doğrulama)**
   - `npm run secrets:verify`
   - İsteğe bağlı tenant filtreli:
   - `npm run secrets:verify -- --tenant-id=123`

## Beklenen davranış

- `secrets:verify`:
  - legacy/plaintext kayıt varsa **exit code 1** ile fail eder.
  - kayıt yoksa PASS verir.
- Scriptler secret içeriğini loglamaz.
- Sadece `id`, `tenantId`, `provider` ve sayısal özetler loglanır.
