# External Integrations

**Analysis Date:** 2025-03-27

## APIs & External Services

**Payments (iyzico):**
- iyzico Checkout Form API — card payments, retrieve, refund, cancel.
- SDK/Client: `iyzipay` npm package; wrapper and endpoints in `src/lib/iyzico.ts`, checkout helpers in `src/lib/iyzico-order-checkout.ts`, tenant credentials in `src/lib/iyzico-config.ts`.
- Env (names only): `IYZIPAY_API_KEY`, `IYZIPAY_SECRET_KEY`, optional `IYZIPAY_URI`; sandbox vs production resolved in `src/lib/iyzico.ts` with `NODE_ENV`.
- HTTP callbacks (incoming): `src/app/api/payment/iyzico/callback/route.ts`, `src/app/api/payment/iyzico/order-callback/route.ts` (host/origin validation via `src/lib/security/allowed-origins.ts`).

**Abuse prevention (Google reCAPTCHA v3):**
- Verify endpoint: `https://www.google.com/recaptcha/api/siteverify` — server helper `src/lib/security/recaptcha.ts` (`RECAPTCHA_SECRET_KEY`).
- Client execution: `src/lib/security/recaptcha-client.ts` (`NEXT_PUBLIC_RECAPTCHA_SITE_KEY`, loads `grecaptcha` on the client).

**CDN / allowed image hosts (Next.js Image):**
- Remote image hostnames configured in `next.config.ts`: `images.unsplash.com`, `placehold.co`.

## Data Storage

**Databases:**
- PostgreSQL — Prisma datasource `prisma/schema.prisma` (`env("DATABASE_URL")`).
- Application access: `src/lib/prisma.ts` (global singleton); tenancy extension `src/lib/tenancy/prisma-client.ts`.

**File Storage:**
- Not detected as a dedicated cloud object store in application code. `@aws-sdk/client-s3` / `@aws-sdk/s3-request-presigner` are present in `package.json` only; no S3 usage found under `src/`.

**Caching:**
- Redis (optional) — `redis` package; used for distributed rate-limit store when `RATE_LIMIT_STORE=redis` and `REDIS_URL` is set (`src/lib/security/rate-limit-store/redis.ts`, `src/lib/security/rate-limit-store/index.ts`). Key prefix via `REDIS_PREFIX` (default `qrmenu:ratelimit`) in `src/lib/security/config.ts`.
- Default mode is in-memory rate limiting when Redis is not configured.

## Authentication & Identity

**Auth Provider:**
- Custom — not a third-party IdP (no Supabase Auth / NextAuth detected in dependencies).
- HQ/admin and staff flows use HMAC-signed cookies and Prisma-backed users; session secret `ADMIN_SESSION_SECRET` in `src/lib/auth.ts`.
- Cookie name and session semantics: `src/lib/auth.ts` (`glidra_admin_session`).
- Optional legacy behavior: `ALLOW_LEGACY_ADMIN_USER_TENANT_LOGIN` referenced in `src/app/actions/admin-login.ts`.

**Token / signing secrets (application-level, not OAuth):**
- Tenant payment secrets at rest: `TENANT_PAYMENT_SECRET_KEY` — `src/lib/secret-crypto.ts` (AES; dev fallback gated by `ALLOW_DEV_PAYMENT_SECRET_FALLBACK`).
- Content preview tokens: `PREVIEW_TOKEN_SECRET`, TTL `PREVIEW_TOKEN_TTL_HOURS` — `src/modules/content/server/preview-token.ts`.
- Cash receipt tokens: `CASH_RECEIPT_TOKEN_SECRET` — `src/lib/cash-receipt-token.ts`.
- Staff set-password token TTL: `STAFF_SET_PASSWORD_TOKEN_TTL_MINUTES` — `src/lib/staff-set-password-token.ts`.

## Monitoring & Observability

**Error Tracking:**
- Not detected — no Sentry/Datadog SDK in `package.json`.

**Logs:**
- `console` usage in development branches (e.g. payment callbacks, Prisma dev connection errors in `src/lib/prisma.ts`); production-oriented messaging without structured logging framework identified.

## CI/CD & Deployment

**Hosting:**
- Not pinned in-repo — no `.github/workflows` found; `VERCEL_URL` suggests Vercel-compatible deployment.

**CI Pipeline:**
- Not detected in repository.

## Environment Configuration

**Required in production (enforced):**
- Validated in `src/lib/env.server.ts` / `src/instrumentation.ts`: `DATABASE_URL`, `ADMIN_SESSION_SECRET`, `TENANT_PAYMENT_SECRET_KEY`, `APP_BASE_URL`; when `RATE_LIMIT_STORE=redis`, `REDIS_URL`.

**Commonly used (non-exhaustive):**
- URLs / hosts: `APP_BASE_URL`, `APP_URL`, `NEXT_PUBLIC_APP_URL`, `ALLOWED_APP_HOSTS`, `DEFAULT_SUBDOMAIN_SUFFIX` — `src/lib/security/allowed-origins.ts`, `src/modules/hq/server/tenant-provisioning.ts`.
- iyzico: see Payments section.
- reCAPTCHA: `RECAPTCHA_SECRET_KEY`, `NEXT_PUBLIC_RECAPTCHA_SITE_KEY`.
- Rate limiting: `RATE_LIMIT_STORE`, `REDIS_URL`, `REDIS_PREFIX` — `src/lib/security/config.ts`.
- Optional checks: `PAYMENT_SECRET_STARTUP_CHECK` — `src/lib/payment-secret-startup-check.ts`.
- Seeding: `DEMO_SEED_CLEAN`, `DEMO_SEED_ALLOW_CLEAN_IN_PROD`, `NODE_ENV` — `prisma/seed.ts`.

**Secrets location:**
- Environment variables on the host/platform; never commit `.env` or real credentials.

## Webhooks & Callbacks

**Incoming:**
- iyzico payment callbacks — `src/app/api/payment/iyzico/callback/route.ts`, `src/app/api/payment/iyzico/order-callback/route.ts` (POST/GET handling per implementation).
- Storefront waiter call — `src/app/api/table-session/waiter-call/route.ts` (POST JSON; uses `runRequestWaiter` from `src/lib/waiter-request-core.ts`).
- Internal redirect resolution for marketing middleware — `src/app/api/internal/redirects/resolve/route.ts` (GET; called from `middleware.ts` with header `x-redirect-resolver`).

**Outgoing:**
- Server-initiated HTTP to Google reCAPTCHA verify URL — `src/lib/security/recaptcha.ts`.
- iyzico REST API calls from server — via `iyzipay` in `src/lib/iyzico.ts` and related payment modules.
- Middleware may `fetch` the internal redirect API — `middleware.ts` → `/api/internal/redirects/resolve`.

---

*Integration audit: 2025-03-27*
