# Coding Conventions

**Analysis Date:** 2025-03-27

## Naming Patterns

**Files:**
- Use **kebab-case** for modules and components: `create-table.ts`, `menu-client.tsx`, `button-variants.ts`, `distributed-rate-limit.ts`, `landing-form.ts`.
- Next.js App Router: route segments as folders (`src/app/restaurant/tables/page.tsx`); private folders use leading underscore when needed (`src/app/restaurant/menu/showcase/_components/`).
- Colocate feature-specific components under the route or module that owns them.

**Functions:**
- Use **camelCase** for functions and methods: `normalizeKeyPart`, `assertTenantLimit`, `logServerError`, `requireManagerSession`.
- Server actions are **named exports** matching the domain verb: `createTable`, `adminLogin` in `src/app/actions/create-table.ts`, `src/app/actions/admin-login.ts`.
- Predicate helpers: `is*` / `has*` / `assert*` as appropriate (`isValidTrMobile`, `assertProductionEnvOrThrow` in `src/lib/env.server.ts`).

**Variables:**
- **camelCase** for locals and parameters; **SCREAMING_SNAKE** for module-level constants and env-related names (`DEFAULT_MESSAGE`, `INVALID_CREDENTIALS_MESSAGE` in `src/lib/rate-limit.ts`, `src/app/actions/admin-login.ts`).
- Type-only imports use `import type { ... }` where separation helps (common in actions and core).

**Types:**
- **PascalCase** for types, interfaces, and classes: `RateLimitInfo`, `TenantLimitResource`, `RateLimitError` in `src/lib/rate-limit.ts`, `src/lib/tenant-limits.ts`.
- Discriminated unions for action outcomes: `TenantStaffLoginAttempt` in `src/app/actions/admin-login.ts` with `kind: "NOT_FOUND" | "ERROR"`.
- String literal unions for bounded domains: `TableActionType` in `src/lib/rate-limit.ts`, `ModuleName` in `src/core/architecture/module-boundaries.ts`.

## Code Style

**Formatting:**
- No committed Prettier config detected; **ESLint** (flat config) is the enforced style gate via `npm run lint`.
- Observed style in `src/`: double-quoted strings in TypeScript, 2-space indentation, semicolons used consistently in sampled files (`src/lib/rate-limit.ts`, `src/app/actions/create-table.ts`).

**Linting:**
- **ESLint 9** with flat config: `eslint.config.mjs`.
- Extends `eslint-config-next` **core-web-vitals** and **typescript** presets (`nextVitals`, `nextTs` from `eslint-config-next`).
- Ignores: `.next/**`, `out/**`, `build/**`, `next-env.d.ts` (see `eslint.config.mjs`).

**TypeScript:**
- **Strict mode** enabled: `tsconfig.json` sets `"strict": true`, `"noEmit": true`, `"moduleResolution": "bundler"`, JSX `"react-jsx"`.
- Scripts use separate config: `tsconfig.scripts.json` extends root with CommonJS for Node tools (`scripts/`, Prisma seed).

## Import Organization

**Order (typical in `src/`):**
1. **Next.js / React** — `next/navigation`, `next/headers`, `next/cache`, `react` (when present).
2. **Third-party** — `@prisma/client`, etc.
3. **Internal** — `@/...` paths (absolute from project root per `tsconfig.json`).

**Path aliases (`tsconfig.json` `paths`):**
- `@/*` → `./src/*` — **primary** import style for app code.
- `@core/*` → `./src/core/*`, `@shared/*` → `./src/shared/*`, `@modules/*` → `./src/modules/*` — configured; **core** package surface is aggregated in `src/core/index.ts` (re-exports still use `@/core/...` internally). Prefer `@/` for most new code unless aligning with an existing module-local pattern.

**Example (server action):**

```typescript
"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireManagerSession } from "@/lib/auth";
```

Reference: `src/app/actions/create-table.ts`.

## Error Handling

**Patterns:**
- **Server actions**: wrap logic in `try/catch`; return **user-facing objects** `{ success: false, message: string }` (often Turkish copy) for expected failures; handle known **Prisma** errors explicitly (e.g. `P2034` serialization) before generic handling (`src/app/actions/create-table.ts`).
- **Domain errors**: use `instanceof` against project error types where exported, e.g. `isTenantLimitExceededError(error)` from `src/lib/tenant-limits.ts` to map limits to structured responses.
- **Unknown errors**: call `logServerError(scope, error)` from `src/lib/server-error-log.ts` with a short scope string, then return a generic failure message — avoids leaking internals in production (production logs message only; dev logs full error).

**Custom errors:**
- Subclass `Error` with extra fields when callers need them, e.g. `RateLimitError` in `src/lib/rate-limit.ts` (`code`, `retryAfterSeconds`).
- Entitlements use `EntitlementLimitExceededError` from `src/core/entitlements/engine` (consumed in `src/lib/tenant-limits.ts`).

**Validation:**
- **Server**: manual normalization of `FormData` (trim, slice, regex) is common in actions — see `src/modules/marketing/actions/landing-form.ts` (`normalizeText`, `normalizeEmail`).
- **Client**: **Zod** appears for form schemas (e.g. `src/modules/marketing/components/landing-lead-form.tsx` imports `z` from `"zod"`); pair with `react-hook-form` / `@hookform/resolvers` as needed.
- **Startup**: `assertProductionEnvOrThrow()` in `src/lib/env.server.ts` fails fast on missing/invalid production configuration (no secret values logged).

## Logging

**Framework:** Node `console` for server diagnostics.

**Patterns:**
- Use `logServerError("scope", error)` from `src/lib/server-error-log.ts` in action catch blocks and similar server paths.
- User-visible security or rate-limit copy may mix Turkish and ASCII-only variants in constants (`src/lib/rate-limit.ts`) — preserve existing tone when editing.

## Comments

**When to Comment:**
- **Module-level** comments explain non-obvious constraints: barrel files document usage (`src/components/editor/index.ts`), env modules document safety (`src/lib/env.server.ts`).
- **Domain rules** in `MODULE_BOUNDARIES` (`src/core/architecture/module-boundaries.ts`) are expressed as data + `summary` strings for architecture guidance.

**JSDoc/TSDoc:**
- Sparse; used where it adds safety context (e.g. `src/lib/server-error-log.ts` file comment, `src/lib/env.server.ts` on `assertProductionEnvOrThrow`).

## Function Design

**Size:** Large UI files exist (e.g. managers under `src/app/restaurant/`); prefer extracting helpers or subcomponents when touching them rather than growing monoliths further.

**Parameters:**
- Server actions often take **positional domain args** plus optional `FormData` for form-backed actions (`adminLogin` in `src/app/actions/admin-login.ts`).
- Options objects for cross-cutting utilities: `shouldBypassRateLimit({ tenantId, allowPrivilegedBypass })` in `src/lib/rate-limit.ts`.

**Return Values:**
- **Discriminated results** for mutations: `{ success: true }` vs `{ success: false, message: string }`, sometimes with extra fields (`limit` on tenant limit errors in `create-table`).
- **Redirecting actions** use `redirect()` from `next/navigation` on success (`src/app/actions/admin-login.ts`).

## Module Design

**Exports:**
- Prefer **named exports** for actions, lib helpers, and types.
- **Barrel files** used selectively: `src/components/editor/index.ts`, `src/core/index.ts` (re-exports core submodules).

**Barrel Files:**
- Use when multiple consumers import the same feature surface (editor, core). Import from the barrel path documented in the barrel comment when adding new editor exports.

**Next.js directives:**
- **`"use server"`** at top of server action modules: `src/app/actions/*.ts`, `src/modules/hq/actions/*.ts`, `src/modules/marketing/actions/landing-form.ts`, etc.
- **`"use client"`** on interactive components and hooks: scattered under `src/app/`, `src/components/`, `src/modules/`, `src/hooks/use-waiter-polling.ts`.

**Architecture boundaries:**
- Documented in `src/core/architecture/module-boundaries.ts` (`MODULE_BOUNDARIES`): modules (`marketing`, `hq`, `restaurant-ops`, `waiter`, `kitchen`, `storefront`, `core`, `shared`), allowed dependencies, and route ownership. New features should align surface and imports with these rules.

---

*Convention analysis: 2025-03-27*
