# Testing Patterns

**Analysis Date:** 2025-03-27

## Test Framework

**Runner:**
- **Not configured.** `package.json` defines no `test` script and lists no Vitest, Jest, or Playwright **devDependency**.
- `package-lock.json` may list `@playwright/test` as a **transitive** dependency of another package; there is **no** `playwright.config.*` or e2e test directory in the repo root.

**Assertion Library:**
- Not applicable — no unit/integration test files present.

**Run Commands:**
```bash
npm run lint          # Static analysis only (ESLint)
npm run build         # Typecheck + Next.js production build (implicit TS gate)
```

There is **no** `npm test`, watch mode, or coverage command today.

## Test File Organization

**Location:**
- **No** co-located `*.test.ts(x)` / `*.spec.ts(x)` files under `src/`.
- **No** `__tests__/` directories detected.

**Naming:**
- Not established — introduce a project-wide pattern when adding tests (recommended: `*.test.ts` next to source or under `src/__tests__/` / `e2e/` by agreement).

**Structure:**
- Not applicable until a runner is added.

## Test Structure

**Suite Organization:**
- Not present in codebase.

**Patterns:**
- **Setup/teardown:** Not used.
- **Assertion pattern:** Not used.

When introducing tests, align with the chosen runner (e.g. Vitest `describe`/`it`/`expect` for units, Playwright `test` for e2e).

## Mocking

**Framework:**
- Not used — no mocking library in `package.json`.

**Patterns:**
- Not applicable.

**What to Mock (guidance for future work):**
- **Prisma** — use a test double or in-memory SQLite/transaction-per-test strategy; real DB optional for integration tests against `prisma/schema.prisma`.
- **External HTTP** — Iyzico, S3 presign, Redis rate limit: mock fetch/SDK clients in unit tests; use contract tests or sandboxes sparingly.
- **`headers()` / `cookies()`** — Next.js server modules; mock via test utilities or integration tests hitting Route Handlers / Server Actions.

**What NOT to Mock:**
- Pure helpers under `src/lib/` (e.g. normalization in `src/modules/marketing/lib/tr-phone.ts`) — test directly without mocks.

## Fixtures and Factories

**Test Data:**
- **Prisma seed** provides repeatable data for **manual** QA: `prisma/seed.ts`, invoked via `npm run db:seed` (`package.json` `prisma.seed`).
- No TypeScript factory modules for tests detected.

**Location:**
- Seed: `prisma/seed.ts`
- Scripts (non-test): `scripts/` (e.g. `scripts/verify-encrypted-secrets.ts`, `scripts/backfill-pii-fields.ts`) — operational, not assertions.

## Coverage

**Requirements:** None enforced; no coverage tooling in `package.json`.

**View Coverage:**
- Not applicable until a test runner with coverage (e.g. Vitest `--coverage`) is added.

## Test Types

**Unit Tests:**
- **None.** Candidate areas: `src/lib/env.server.ts` validation rules, `src/lib/server-error-log.ts`, pure parsers in `src/modules/marketing/lib/`, `src/core/routing/app-surface.ts` path logic.

**Integration Tests:**
- **None.** Candidate areas: Server Actions in `src/app/actions/` with Prisma transactions; rate limiting in `src/lib/security/distributed-rate-limit.ts` (requires Redis or test double).

**E2E Tests:**
- **Not used.** Adding Playwright or Cypress would require new config, CI wiring, and stable test accounts/tenants (see `prisma/seed.ts`).

## Common Patterns

**Async Testing:**
- Not present — when adding Vitest, use `async` `it` blocks and `await expect(promise).resolves/rejects`.

**Error Testing:**
- Not present — mirror production patterns: `instanceof` custom errors (`RateLimitError` in `src/lib/rate-limit.ts`, `TenantLimitExceededError` via `isTenantLimitExceededError` in `src/lib/tenant-limits.ts`).

## Quality gates today

- **ESLint:** `eslint.config.mjs` + `npm run lint`.
- **TypeScript:** `strict` compilation via Next build (`npm run build`).
- **Manual / seed-driven:** Local verification with `npm run dev` and seeded data.

---

*Testing analysis: 2025-03-27*
