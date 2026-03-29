# Codebase Structure

**Analysis Date:** 2026-03-27

## Directory Layout

```
qrmenu-order/
├── middleware.ts              # Edge: surfaces, tenant slug headers, redirects, security headers
├── next.config.ts             # Next.js config (reactCompiler, serverExternalPackages, images)
├── package.json               # Scripts and dependencies
├── tsconfig.json              # Path aliases @/*, @core/*, @shared/*, @modules/*
├── prisma/
│   ├── schema.prisma          # PostgreSQL schema
│   ├── migrations/            # SQL migrations
│   └── seed.ts                # DB seed
├── scripts/                   # ts-node maintenance scripts (secrets, PII backfill)
├── public/                    # Static assets (if present)
├── docs/                      # Project documentation (e.g. architecture ADRs)
└── src/
    ├── app/                   # Next.js App Router: routes, layouts, actions, API routes
    │   ├── layout.tsx         # Root layout
    │   ├── globals.css
    │   ├── error.tsx
    │   ├── sitemap.ts
    │   ├── actions/           # Shared server actions (*.ts, "use server")
    │   ├── api/               # Route handlers (route.ts per segment)
    │   ├── (hq)/hq/           # HQ route group: nested admin UI
    │   ├── (storefront)/      # Customer menu/order UI (tenant layout)
    │   ├── restaurant/        # Manager/restaurant ops panel
    │   ├── waiter/            # Waiter panel
    │   ├── kitchen/           # Kitchen panel
    │   ├── m/[publicCode]/    # QR short link → menu redirect
    │   ├── menu/              # Additional storefront-related routes (outside group)
    │   ├── payment/           # Payment flows (e.g. mock pages)
    │   ├── order-success/     # Post-checkout UX
    │   ├── blog/, pages/, legal/  # Marketing / content pages
    │   ├── staff/, glidragiris/, admin/  # Auth and legacy paths
    │   └── ...
    ├── components/            # Shared React components (editor, content, UI bits)
    ├── constants/             # App-wide constants (e.g. `src/constants/marketing.ts`)
    ├── core/                  # Cross-cutting policies (authz, surfaces, entitlements)
    ├── hooks/                 # Client hooks (e.g. `src/hooks/use-waiter-polling.ts`)
    ├── lib/                   # Services, Prisma client, auth, security, tenancy, payments
    ├── modules/               # Feature modules: hq, marketing, content, onboarding
    └── shared/                # Reserved for generic primitives (`src/shared/README.md`)
```

## Directory Purposes

**`src/app/`:**
- Purpose: All routable UI, Route Handlers, and colocated server-only modules for those routes.
- Contains: `page.tsx`, `layout.tsx`, `loading.tsx` (where used), `route.ts`, feature-specific `*_manager.tsx` / `*-section.tsx` next to pages.
- Key files: `src/app/layout.tsx`, `src/app/(storefront)/layout.tsx`, `src/app/restaurant/layout.tsx`, `src/app/(hq)/hq/layout.tsx`, `src/app/m/[publicCode]/route.ts`, `src/app/actions/*.ts`

**`src/app/actions/`:**
- Purpose: Central collection of Server Actions invoked from multiple routes (restaurant, waiter, storefront, etc.).
- Contains: One concern per file (e.g. `category-crud.ts`, `create-order.ts`).

**`src/app/api/`:**
- Purpose: HTTP endpoints that must not be Server Actions (webhooks, internal resolver, waiter-call).
- Contains: Nested folders each ending with `route.ts`.

**`src/core/`:**
- Purpose: Stable rules for surfaces, capabilities, entitlements, tenancy lifecycle; module boundary definitions.
- Key files: `src/core/routing/app-surface.ts`, `src/core/surfaces/guard.ts`, `src/core/authz/policy.ts`, `src/core/architecture/module-boundaries.ts`, `src/core/README.md`

**`src/lib/`:**
- Purpose: Application-level libraries (database client, auth, payments, sanitization, rate limits, audit).
- Key files: `src/lib/prisma.ts`, `src/lib/auth.ts`, `src/lib/tenancy/context.ts`, `src/lib/server-action-guard.ts`, `src/lib/table-session.ts`

**`src/modules/`:**
- Purpose: Extracted HQ, marketing, content, and onboarding slices with `actions/`, `server/`, `components/`.
- Key files: `src/modules/hq/components/hq-shell.tsx`, `src/modules/README.md`

**`src/components/`:**
- Purpose: Reusable UI not tied to a single route (rich text editor, refresh polling, embed renderer).
- Key files: `src/components/editor/index.ts`, `src/components/refresh-polling.tsx`

**`prisma/`:**
- Purpose: Schema, migrations, seed — single source of truth for data model.

**`scripts/`:**
- Purpose: Operational TypeScript scripts run with `ts-node` / `package.json` commands (not part of Next bundle).

## Key File Locations

**Entry Points:**
- `middleware.ts`: Edge request pipeline.
- `src/app/layout.tsx`: HTML shell for all pages.
- `src/app/page.tsx`: Marketing landing.

**Configuration:**
- `next.config.ts`: Next.js.
- `tsconfig.json`: TypeScript and path aliases.
- `prisma/schema.prisma`: Database.
- `.env` (not read for this doc): Environment variables — file presence expected for local/prod.

**Core Logic:**
- `src/lib/auth.ts`: Sessions and role gates.
- `src/lib/tenancy/context.ts`: Tenant resolution and ALS.
- `src/core/surfaces/guard.ts`: Surface authorization.

**Testing:**
- Not detected: no `jest.config.*`, `vitest.config.*`, or pervasive `*.test.ts` pattern in exploration. Add tests alongside the stack the project adopts (see future `TESTING.md`).

## Naming Conventions

**Files:**
- Routes: Next.js conventions — `page.tsx`, `layout.tsx`, `route.ts`, folder names often `kebab-case` or dynamic `[param]`.
- Server actions: `kebab-case` or descriptive compound filenames in `src/app/actions/` (e.g. `category-crud.ts`, `request-waiter.ts`).
- Lib/modules: `kebab-case.ts` for utilities; React components typically `PascalCase.tsx` or descriptive `feature-part.tsx` in app folders.

**Directories:**
- Route groups: parentheses e.g. `(hq)`, `(storefront)`.
- Module subfolders: `actions`, `server`, `components`, `lib` under `src/modules/<name>/`.

**Code identifiers:**
- React components: `PascalCase`.
- Functions: `camelCase`.
- Types/constants: `PascalCase` / `UPPER_SNAKE` as used in `src/core/authz/capabilities.ts` and Prisma enums.

## Where to Add New Code

**New Feature (full stack):**
- Primary UI: under `src/app/` in the surface that matches product area (e.g. new manager page under `src/app/restaurant/...`).
- If the feature is HQ-specific and sizeable: prefer `src/modules/hq/` (`components/`, `server/`, `actions/`) and thin `page.tsx` wrappers under `src/app/(hq)/hq/...`.
- Shared policy: extend `src/core/` only when the rule applies across modules (new capability → `src/core/authz/capabilities.ts` + `policy.ts`).

**New Server Action:**
- If used from one route only: colocate in `actions.ts` next to that route **or** add to `src/app/actions/<feature>.ts` if multiple surfaces call it (match existing files like `src/app/actions/product-crud.ts`).

**New API Route (webhook or public HTTP):**
- Implementation: `src/app/api/<area>/<name>/route.ts`.
- Wire security: rate limits / origin checks under `src/lib/security/` as with `src/app/api/payment/iyzico/callback/route.ts`.

**New Prisma Model or Field:**
- Schema: `prisma/schema.prisma`; migration: `npx prisma migrate dev` (project uses `prisma/migrations/`).

**Utilities:**
- Generic, domain-heavy helpers: `src/lib/<topic>.ts`.
- Pure cross-module primitives (when introduced): `src/shared/` per `src/shared/README.md`.

**New Module Slice:**
- Follow `src/modules/README.md`: add under `src/modules/<name>/` with `README.md`, and register intent in `src/core/architecture/module-boundaries.ts` if the surface/ownership is new.

## Special Directories

**`.next/`:**
- Purpose: Next.js build output.
- Generated: Yes.
- Committed: No (typically gitignored).

**`prisma/migrations/`:**
- Purpose: Versioned SQL migrations.
- Generated: Via Prisma CLI.
- Committed: Yes.

**`src/app/(hq)/` and `src/app/(storefront)/`:**
- Purpose: Route groups — **do not** affect URL segment; organize layouts and shared layout boundaries.
- Parentheses are literal folder names on disk.

---

*Structure analysis: 2026-03-27*
