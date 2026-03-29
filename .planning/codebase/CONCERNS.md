# Codebase Concerns

**Analysis Date:** 2025-03-27

## Tech Debt

**Monolithic server actions and panels:**
- Issue: Ordering and payment flows bundle validation, pricing, entitlements, risk scoring, and persistence in single modules; restaurant cash UI is a large client component. This raises merge conflict risk and makes targeted testing harder without a test runner.
- Files: `src/app/actions/create-order.ts`, `src/app/restaurant/cash/cash-terminal.tsx`, `src/lib/auth.ts`
- Impact: Slower onboarding for contributors; higher regression risk when changing one concern inside a large file.
- Fix approach: Extract pure helpers (pricing, cart normalization, payment branching) into `src/lib/` with stable types; split `cash-terminal.tsx` into subcomponents and hooks under `src/app/restaurant/cash/_components/` (or `src/modules/restaurant-cash/`).

**Prisma schema surface area:**
- Issue: `prisma/schema.prisma` spans many models and domains in one file.
- Files: `prisma/schema.prisma`
- Impact: Migrations and reviews are heavy; accidental coupling across domains.
- Fix approach: Use Prisma `schema` folder split when the team is ready; document bounded contexts in `ARCHITECTURE.md` before splitting.

**Prisma 6 composite-key workaround:**
- Issue: Staff auth uses `findFirst` instead of `findUnique` and a separate raw query for `weeklyShiftSchedule` to avoid select/schema mismatch errors.
- Files: `src/lib/auth.ts` (`loadTenantStaffForAuth`, `loadWeeklyShiftScheduleByStaffId`)
- Impact: Extra query per auth load; swallowed errors in `loadWeeklyShiftScheduleByStaffId` (`catch { return null }`) can hide real DB failures.
- Fix approach: Align Prisma schema and JSON column typing so `weeklyShiftSchedule` is selectable in one query; replace silent `catch` with structured logging for unexpected errors.

**React hook dependency suppression:**
- Issue: `useEffect` intentionally omits dependencies to avoid resetting draft payment lines when other fields on `selected` change.
- Files: `src/app/restaurant/cash/cash-terminal.tsx` (around the `eslint-disable-next-line react-hooks/exhaustive-deps` near `selected?.tableId`)
- Impact: If `selected` is replaced with same `tableId` but different financial state, draft lines might not reset as expected.
- Fix approach: Depend on a stable key (e.g. `selected?.finance.remainingAmount` or a session version) or reset draft in `onSelectTable` only with explicit UX rules.

**Root maintenance scripts:**
- Issue: `fix-reports.js`, `fix-mojibake.js`, `fix-settings.js` disable TypeScript ESLint rules for `require`.
- Files: `fix-reports.js`, `fix-mojibake.js`, `fix-settings.js`
- Impact: Low; one-off scripts sit outside `src/` conventions.
- Fix approach: Move under `scripts/` with `ts-node` + shared `tsconfig.scripts.json` or add minimal JSDoc types.

## Known Bugs

**Not classified from static analysis alone:**
- Symptoms: No automated test suite reproduces user-reported failures in-repo (see **Test coverage gaps**).
- Files: N/A
- Trigger: N/A
- Workaround: Rely on manual UAT and production monitoring until tests exist.

## Security Considerations

**Public internal redirect resolver:**
- Risk: `GET /api/internal/redirects/resolve` returns whether a path matches a redirect rule and the target path. The middleware sets `x-redirect-resolver` when calling this endpoint, but the route handler does not verify that header (or any secret), so any client can query redirect mappings.
- Files: `src/app/api/internal/redirects/resolve/route.ts`, `middleware.ts`
- Current mitigation: Data is non-secret in many cases; still useful for SEO/history only.
- Recommendations: Require an internal shared secret header verified in the route, or restrict via edge config / IP allowlist if redirect targets must stay non-enumerable.

**HTML rendered with `dangerouslySetInnerHTML`:**
- Risk: XSS if unsanitized HTML reaches the DOM (CMS pages, blog, embed blocks, legal static HTML, editor preview).
- Files: `src/app/pages/[slug]/page.tsx`, `src/app/blog/[slug]/page.tsx`, `src/components/content/content-embed-blocks-renderer.tsx`, `src/components/editor/rich-text-renderer.tsx`, `src/components/editor/rich-text-editor.tsx`, `src/app/legal/gizlilik/page.tsx`, `src/app/legal/kullanici-sozlesmesi/page.tsx`, `src/app/legal/kvkk/page.tsx`, `src/modules/hq/components/content-embed-blocks-section.tsx`, HQ preview pages under `src/app/(hq)/hq/content/`
- Current mitigation: Server-side sanitization pipelines (`src/lib/embed-blocks/sanitize-custom-code-server.ts`, rich-text sanitizers under `src/lib/sanitize-rich-html-*.ts`, `src/components/editor/sanitize.ts`).
- Recommendations: Periodic review that every persistence path runs the same sanitizer as render; add CSP where compatible with Next.js app (in addition to headers set in `middleware.ts`).

**Production CSRF hardening depends on browser headers:**
- Risk: `assertPrivilegedServerActionOrigin` is a no-op outside production and only rejects `Sec-Fetch-Site: cross-site` plus basic origin/host alignment in production.
- Files: `src/lib/server-action-guard.ts`
- Current mitigation: SameSite cookies and Next server action model.
- Recommendations: Document non-browser clients are unsupported for privileged actions; consider stricter origin allowlists for HQ operations if threat model requires it.

**Payment callback abuse guard fail-open:**
- Risk: When the distributed rate-limit store is unavailable, payment callback paths use `failureMode: "fail-open"` so callbacks still process.
- Files: `src/app/api/payment/iyzico/callback/route.ts`, `src/app/api/payment/iyzico/order-callback/route.ts`, `src/lib/security/payment-rate-limit.ts`, `src/lib/security/distributed-rate-limit.ts`
- Current mitigation: Availability over temporary lockout; logs warn on fail-open.
- Recommendations: Monitor Redis (or configured store) uptime; consider `fail-closed` for specific high-abuse tenants or a circuit breaker after repeated store errors.

**Development payment secret fallback:**
- Risk: If `TENANT_PAYMENT_SECRET_KEY` is missing, a dev fallback may be used; misconfiguration in non-dev environments could weaken encryption expectations.
- Files: `src/lib/dev-secret-warning.ts` (warning helper; callers in payment secret crypto path)
- Current mitigation: Explicit warning and env flag semantics (see warning message in `warnDevPaymentSecretFallbackOnce`).
- Recommendations: Ensure deployment checklists require the env var; fail boot in production if fallback would activate (if not already enforced at call sites).

## Performance Bottlenecks

**Staff session load:**
- Problem: Loading staff for auth can execute Prisma `findFirst` plus an extra `$queryRaw` for `weeklyShiftSchedule` per request.
- Files: `src/lib/auth.ts`
- Cause: Schema/workaround split (see Tech Debt).
- Improvement path: Collapse to one query after schema alignment; cache read-mostly staff fields where safe (short TTL, tenant-scoped).

**Middleware redirect resolution:**
- Problem: On matching marketing paths, middleware performs an internal `fetch` to `/api/internal/redirects/resolve` on every GET/HEAD.
- Files: `middleware.ts`
- Impact: Extra latency and Edge invocations on cold paths.
- Improvement path: Inline redirect resolution in middleware using shared `resolveActiveRedirectRule` from `src/modules/content/server/redirect-rules.ts` if bundle constraints allow, or cache recent paths at the edge.

**Large client bundles:**
- Problem: Heavy panels (e.g. cash terminal) pull many hooks and action imports into one client component.
- Files: `src/app/restaurant/cash/cash-terminal.tsx`
- Cause: Single-file UI composition.
- Improvement path: `dynamic()` for rarely used panels, split routes, and smaller action surface per chunk.

## Fragile Areas

**Order creation and payment branching:**
- Files: `src/app/actions/create-order.ts`, `src/lib/iyzico-order-checkout.ts`, `src/lib/settle-bill-gateway.ts`
- Why fragile: Many early returns, entitlements, table session checks, and gateway calls; small changes can break tenant isolation or payment state.
- Safe modification: Run through `npm run build`; manually test storefront order + Iyzico mock in non-production; verify `TableSessionError` and `RateLimitError` paths unchanged.
- Test coverage: No automated tests (see `.planning/codebase/TESTING.md`).

**Bill settlement and row locking:**
- Files: `src/app/actions/settle-bill-with-payment.ts`, `src/lib/settle-bill-gateway.ts`, `src/lib/table-account-transfer-core.ts`, `src/app/actions/adjust-cash-order-item.ts`
- Why fragile: Uses `FOR UPDATE` via `$queryRaw` inside transactions; ordering of locks matters for deadlocks.
- Safe modification: Keep transaction boundaries small; avoid new lock order without review; add integration tests when a runner exists.

**Content embed and custom code sanitization:**
- Files: `src/lib/embed-blocks/sanitize-custom-code-server.ts`, `src/lib/embed-blocks/sanitize-html-embed-client.ts`, `src/modules/hq/components/content-embed-blocks-section.tsx`
- Why fragile: Allowlist and parser behavior (`linkedom`) must stay aligned with what HQ editors can submit.
- Safe modification: Pair any allowlist change with manual XSS probes and mirror client/server rules.

## Scaling Limits

**In-memory vs Redis rate limiting:**
- Resource: Rate limit store abstraction under `src/lib/security/rate-limit-store/`.
- Current capacity: Depends on deployment (Redis vs memory); fail-open paths degrade protection before degrading core ordering.
- Limit: Single-region assumptions unless Redis is shared across instances.
- Scaling path: Mandatory Redis (or equivalent) in production for all instances; tune policies in `src/lib/rate-limit.ts` and `src/lib/security/payment-rate-limit.ts`.

**Tenant-scoped operational queries:**
- Resource: Manager/waiter/kitchen lists load recent orders and tables.
- Limit: Large tenants may need pagination, indexes, and archival strategy (not fully auditable from this pass).
- Scaling path: Review Prisma indexes and add cursor-based pagination on hot list endpoints.

## Dependencies at Risk

**iyzipay and payment vendor lock-in:**
- Risk: Gateway-specific types and flows spread across `src/lib/iyzico*.ts` and API routes under `src/app/api/payment/iyzico/`.
- Impact: Adding a second PSP duplicates branching in actions and callbacks.
- Migration plan: Introduce a narrow `PaymentGateway` interface in `src/lib/payments/` and delegate Iyzico to one adapter.

**Next.js major upgrades:**
- Risk: App Router, middleware, and security headers evolve between majors (`next.config.ts`, `middleware.ts`).
- Impact: Regression in matcher, Edge runtime, or server actions.
- Migration plan: Follow release notes; run full manual flows per tenant surface after upgrade.

## Missing Critical Features

**Automated regression tests:**
- Problem: No unit, integration, or E2E tests are defined in `package.json`; no `*.test.*` / `*.spec.*` under `src/`.
- Blocks: Safe refactoring of ordering, payments, and auth without long manual passes.

## Test Coverage Gaps

**Core commerce and auth:**
- What's not tested: Order creation (`create-order`), staff/manager auth (`auth.ts`), Iyzico callbacks, bill settlement, table session enforcement, tenant isolation on server actions.
- Files: `src/app/actions/create-order.ts`, `src/lib/auth.ts`, `src/app/api/payment/iyzico/callback/route.ts`, `src/lib/table-session.ts`
- Risk: Regressions ship until caught manually or in production.
- Priority: High

**Sanitization and content rendering:**
- What's not tested: HTML allowlists, embed block sanitizers, redirect rule resolution.
- Files: `src/lib/sanitize-rich-html-client.ts`, `src/lib/embed-blocks/sanitize-custom-code-server.ts`, `src/modules/content/server/redirect-rules.ts`
- Risk: XSS or broken rendering after refactors.
- Priority: High

**Rate limiting and abuse controls:**
- What's not tested: Distributed limiter behavior, fail-open vs fail-closed, payment callback rate keys.
- Files: `src/lib/security/distributed-rate-limit.ts`, `src/lib/security/payment-rate-limit.ts`
- Risk: Silent behavior change under load or Redis failures.
- Priority: Medium

---

*Concerns audit: 2025-03-27*
