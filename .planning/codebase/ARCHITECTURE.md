# Architecture

**Analysis Date:** 2026-03-27

## Pattern Overview

**Overall:** Next.js App Router modular monolith (single deployable) with explicit multi-tenant boundaries, role-based staff panels, and a public customer ordering plane.

**Key Characteristics:**
- Route-driven **app surfaces** (marketing, HQ, restaurant ops, waiter, kitchen, storefront) resolved from pathname and propagated via request headers.
- **Server-first** data access: React Server Components, Server Actions (`"use server"`), and a small set of Route Handlers under `src/app/api/`.
- **Tenant isolation** via header-derived or session-derived tenant context (`getCurrentTenantOrThrow` in `src/lib/tenancy/context.ts`), explicit `where` clauses on `prisma` queries, and optional strict Prisma extension (`src/lib/tenancy/prisma-client.ts` — currently not wired as the default client; application code uses `src/lib/prisma.ts`).
- **Cross-cutting policy** in `src/core/` (capabilities, surface guard, entitlements, lifecycle) documented as the stable backbone (`src/core/README.md`).

## Layers

**Presentation (App Router + shared UI):**
- Purpose: URL entry, layouts, pages, client islands, and global styles.
- Location: `src/app/`, `src/components/`
- Contains: `page.tsx`, `layout.tsx`, `error.tsx`, route handlers, co-located feature UI under route folders, reusable components (e.g. `src/components/editor/`, `src/components/refresh-polling.tsx`).
- Depends on: `src/lib/*`, `src/core/*`, `src/modules/*`, `@prisma/client` (indirectly through lib).
- Used by: Browser and edge requests; composed by Next.js.

**Domain modules (bounded contexts, incremental extraction):**
- Purpose: HQ workflows, marketing server/helpers, content/CMS helpers, onboarding UI — **feature slices** moving toward clearer boundaries (`src/modules/README.md`).
- Location: `src/modules/hq/`, `src/modules/marketing/`, `src/modules/content/`, `src/modules/onboarding/`, module READMEs under `src/modules/*/README.md`.
- Contains: `actions/` (server actions used from HQ/marketing), `server/` (queries, provisioning), `components/`, `lib/`.
- Depends on: `src/core/*`, `src/lib/*`, Prisma.
- Used by: App routes (especially `src/app/(hq)/hq/`) and marketing pages.

**Cross-cutting core (policies, not feature UI):**
- Purpose: Authz model, surface ↔ capability mapping, entitlements, tenancy lifecycle rules, routing surface taxonomy, module boundary metadata.
- Location: `src/core/`
- Contains: `src/core/routing/app-surface.ts`, `src/core/surfaces/surface-map.ts`, `src/core/surfaces/guard.ts`, `src/core/surfaces/types.ts`, `src/core/authz/*`, `src/core/entitlements/engine.ts`, `src/core/tenancy/lifecycle-policy.ts`, `src/core/architecture/module-boundaries.ts`, `src/core/index.ts`.
- Depends on: Minimal — primarily types and internal core modules; may call into `src/lib` for DB where policies need data.
- Used by: `src/lib/auth.ts`, server actions, and API routes that enforce surface/capability rules.

**Application services & integrations (`lib`):**
- Purpose: Auth sessions, Prisma singleton, payment (Iyzico), table sessions, rate limits, sanitization, audit, tenancy resolution, security helpers.
- Location: `src/lib/`
- Contains: `src/lib/auth.ts`, `src/lib/prisma.ts`, `src/lib/tenancy/context.ts`, `src/lib/server-action-guard.ts`, `src/lib/server-error-log.ts`, payment and security files under `src/lib/` and `src/lib/security/`.
- Depends on: `next/headers`, `next/navigation`, `@prisma/client`, `src/core/*` where authz/surface checks run.
- Used by: All server layers.

**Data:**
- Purpose: PostgreSQL schema and migrations.
- Location: `prisma/schema.prisma`, `prisma/migrations/`, `prisma/seed.ts`
- Contains: Models, enums, datasource config (`DATABASE_URL`).
- Depends on: Not applicable (schema is source of truth).
- Used by: `PrismaClient` via `src/lib/prisma.ts`.

**Edge middleware:**
- Purpose: Marketing redirects, security headers, and injection of surface + tenant slug headers for downstream Server Components and actions.
- Location: `middleware.ts` (repository root)
- Contains: `resolveAppSurface`, `mapAppSurfaceToSecuritySurface`, `resolveTenantSlugFromRequest`, optional internal fetch to `src/app/api/internal/redirects/resolve/route.ts`.
- Depends on: `src/core/routing/app-surface.ts`, `src/core/surfaces/surface-map.ts`, `src/lib/tenancy/resolve.ts`.

## Data Flow

**Authenticated staff request (e.g. restaurant manager):**

1. Request hits `middleware.ts`: pathname → `resolveAppSurface`; optional `x-tenant-slug` from `resolveTenantSlugFromRequest`; sets `x-app-surface`, `x-security-surface`, `x-request-pathname`, and security headers.
2. `src/app/restaurant/layout.tsx` (and similar) calls `requireCashierOrManagerSession()` from `src/lib/auth.ts`, enforces path access via `src/lib/restaurant-panel-access.ts`.
3. Server Actions in `src/app/actions/*.ts` call `assertPrivilegedServerActionOrigin()` (production CSRF-ish checks), session helpers (`requireManagerSession`, etc.), then `getCurrentTenantOrThrow()` to align tenant with session.
4. Mutations use `prisma` from `src/lib/prisma.ts` with explicit tenant-scoped `where` / joins; audit via `src/lib/audit-log.ts` where implemented.

**Storefront (customer menu / order):**

1. Short link `src/app/m/[publicCode]/route.ts` resolves table by public code, applies rate/risk checks, sets table session cookie, redirects to `src/app/(storefront)/menu/[slug]/[tableId]/page.tsx` (or equivalent path).
2. `src/app/(storefront)/layout.tsx` calls `getCurrentTenantOrThrow()`, loads restaurant, wraps children with `runWithTenantContext({ tenantId, slug }, ...)` from `src/lib/tenancy/context.ts` so downstream code can read tenant from AsyncLocalStorage where used.

**Payment webhook / callback:**

1. `src/app/api/payment/iyzico/callback/route.ts` (and related routes) run outside typical page layouts; validate host/origin and rate limits, use `prisma` and settlement helpers (`src/lib/settle-bill-gateway.ts`, `src/lib/iyzico-config.ts`).

**State Management:**
- Server state: PostgreSQL via Prisma; cache revalidation via `revalidatePath` / `revalidateTag` in actions where used.
- Client state: Local component state and hooks (e.g. `src/hooks/use-waiter-polling.ts`); no global Redux-style store documented in-tree.
- Session state: HTTP-only cookies for admin/staff (`src/lib/auth.ts`), table session helpers (`src/lib/table-session.ts`).

## Key Abstractions

**AppSurface:**
- Purpose: Classify the request by URL prefix for tenancy and isolation labeling.
- Examples: `src/core/routing/app-surface.ts` (`marketing`, `hq`, `restaurant-ops`, `waiter`, `kitchen`, `storefront`, `unknown`).
- Pattern: Prefix table + ordered matching; helpers `isTenantAwareSurface`, `isPublicAttackSurface`.

**SecuritySurface:**
- Purpose: Finer security classification for policy (capabilities, lifecycle, feature flags).
- Examples: `src/core/surfaces/types.ts`, mapping in `src/core/surfaces/surface-map.ts`.
- Pattern: Every `AppSurface` maps to exactly one `SecuritySurface` via `mapAppSurfaceToSecuritySurface`.

**Surface guard:**
- Purpose: Central check that an `AuthorizationActor` may operate on a given surface and optional tenant lifecycle/feature requirements.
- Examples: `src/core/surfaces/guard.ts` (`assertSurfaceGuard`, `SurfaceGuardError`).
- Pattern: Map surface → required base capability; delegate to `src/core/authz/policy.ts` and `src/core/tenancy/lifecycle-policy.ts`.

**AuthorizationActor & Capability:**
- Purpose: Unify HQ admin, staff roles, storefront guest, and system (webhook) actors with a capability vocabulary.
- Examples: `src/core/authz/actors.ts`, `src/core/authz/capabilities.ts`, `src/core/authz/policy.ts`.

**TenantContext (AsyncLocalStorage):**
- Purpose: Propagate `tenantId` (and optional `slug`) through synchronous/async call stacks on the storefront branch.
- Examples: `src/lib/tenancy/context.ts` (`tenantStorage`, `runWithTenantContext`, `getCurrentTenantOrThrow`).
- Pattern: Middleware/header/session resolution first; ALS for storefront layout children.

**Module boundaries (documentation contract):**
- Purpose: Encode intended dependencies between marketing, hq, restaurant-ops, waiter, kitchen, storefront, core, shared.
- Examples: `src/core/architecture/module-boundaries.ts` (`MODULE_BOUNDARIES`).

## Entry Points

**Next.js app bootstrap:**
- Location: `src/app/layout.tsx`
- Triggers: All HTML responses.
- Responsibilities: Root `<html lang="tr">`, `globals.css`, metadata/viewport.

**Middleware:**
- Location: `middleware.ts`
- Triggers: All matched paths (excludes `admin`, `api`, static assets per `config.matcher`).
- Responsibilities: Redirect resolution, surface headers, tenant slug header, browser security headers.

**Marketing home:**
- Location: `src/app/page.tsx`
- Triggers: `/`

**Staff login / HQ:**
- Examples: `src/app/glidragiris/page.tsx`, `src/app/(hq)/hq/layout.tsx` (`requireHqSession`), `src/app/(hq)/hq/page.tsx`

**Restaurant / waiter / kitchen shells:**
- Examples: `src/app/restaurant/layout.tsx`, `src/app/waiter/layout.tsx`, `src/app/kitchen/page.tsx`

**Storefront:**
- Examples: `src/app/m/[publicCode]/route.ts`, `src/app/(storefront)/layout.tsx`, menu pages under `src/app/(storefront)/`

**Server Actions aggregate:**
- Location: `src/app/actions/*.ts` — each file exports one or more `"use server"` functions for mutations and reads used by panels and storefront.

**HTTP APIs (Route Handlers):**
- Location: `src/app/api/payment/iyzico/callback/route.ts`, `src/app/api/payment/iyzico/order-callback/route.ts`, `src/app/api/table-session/waiter-call/route.ts`, `src/app/api/internal/redirects/resolve/route.ts`

**Background / CLI scripts:**
- Location: `scripts/backfill-encrypted-secrets.ts`, `scripts/verify-encrypted-secrets.ts`, `scripts/backfill-pii-fields.ts` (invoked via `package.json` scripts and `ts-node`).

## Error Handling

**Strategy:** Combine Next.js error boundaries with action-level `try/catch`, structured logging, and typed domain errors for tenancy/authz.

**Patterns:**
- Server Actions: catch unknown errors, call `logServerError` from `src/lib/server-error-log.ts`, return user-safe `{ success: false, message: ... }` objects (see `src/app/actions/category-crud.ts`).
- Route Handlers: return `NextResponse` with appropriate HTTP status; payment callbacks use guarded logging to avoid leaking internals (`src/app/api/payment/iyzico/callback/route.ts`).
- UI errors: `src/app/error.tsx` for route-level failures; dedicated views such as `src/components/tenant-resolution-error-view.tsx` where applicable.

## Cross-Cutting Concerns

**Logging:** `console` in dev-sensitive paths; `src/lib/server-error-log.ts` for server action failures; security warnings in payment and origin validation code.

**Validation:** Zod and custom checks in forms/actions; rich HTML sanitization in `src/lib/sanitize-rich-html-server.ts` and related client/server sanitizers.

**Authentication:** HMAC-signed cookie session in `src/lib/auth.ts` (`glidra_admin_session`); role-specific `require*` helpers; HQ vs tenant-scoped staff semantics.

---

*Architecture analysis: 2026-03-27*
