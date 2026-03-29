# Technology Stack

**Analysis Date:** 2025-03-27

## Languages

**Primary:**
- TypeScript (see `typescript` in `package.json`, `^5`) — application source under `src/`, Prisma schema and seeds, utility scripts under `scripts/`.

**Secondary:**
- CSS — global styles in `src/app/globals.css`; Tailwind v4 via PostCSS.
- SQL — migrations and schema in `prisma/` (generated client is TypeScript).

## Runtime

**Environment:**
- Node.js — required by Next.js 16 and Prisma CLI; exact version not pinned in-repo (no `.nvmrc` detected).

**Package Manager:**
- npm — `package-lock.json` present at repository root.
- Lockfile: present (`package-lock.json`).

## Frameworks

**Core:**
- Next.js `16.1.6` — App Router, config in `next.config.ts` (React Compiler enabled, `serverExternalPackages: ["iyzipay"]`, `images.remotePatterns` for `images.unsplash.com` and `placehold.co`).
- React `19.2.3` / `react-dom` `19.2.3` — UI.

**Data:**
- Prisma `6.4.1` / `@prisma/client` `6.4.1` — ORM; datasource PostgreSQL in `prisma/schema.prisma` (`provider = "postgresql"`, `url = env("DATABASE_URL")`).
- Global Prisma singleton: `src/lib/prisma.ts`.
- Tenant-scoped query extension: `src/lib/tenancy/prisma-client.ts`.

**Testing:**
- Not detected — no `jest`, `vitest`, or `*.test.*` / `*.spec.*` files in `package.json` scripts or repo scan.

**Build/Dev:**
- `next dev` / `next build` / `next start` — scripts in `package.json`.
- `ts-node` with `tsconfig.scripts.json` — Prisma seed (`prisma/seed.ts`) and scripts (`scripts/backfill-encrypted-secrets.ts`, `scripts/verify-encrypted-secrets.ts`).
- ESLint `^9` with `eslint-config-next` `16.1.6` — `eslint.config.mjs`.
- Tailwind CSS `^4` with `@tailwindcss/postcss` — `postcss.config.mjs`.
- `babel-plugin-react-compiler` `1.0.0` — paired with `reactCompiler: true` in `next.config.ts`.

## Key Dependencies

**Critical:**
- `next`, `react`, `react-dom` — application shell and routing.
- `@prisma/client`, `prisma` — persistence and migrations (`prisma/migrations/`).
- `zod` — validation (used across server actions and modules).
- `iyzipay` — iyzico payment gateway (wrapped in `src/lib/iyzico.ts`, externalized on server in `next.config.ts`).
- `redis` (`^4.7.1`) — optional distributed rate limiting when `RATE_LIMIT_STORE=redis` (`src/lib/security/rate-limit-store/redis.ts`).

**UI & forms:**
- `react-hook-form`, `@hookform/resolvers` — forms.
- `@tiptap/*` — rich text editing.
- `@uiw/react-codemirror`, `@codemirror/lang-html` — HTML editing.
- `lucide-react`, `@hugeicons/react`, `@hugeicons/core-free-icons` — icons.
- `motion` — animation.
- `@number-flow/react` — numeric UI.
- `react-hot-toast` — toasts.
- `qrcode` — QR generation (types: `@types/qrcode`).

**Infrastructure / parsing:**
- `dotenv` — script/env loading where used.
- `linkedom` — DOM/HTML parsing in server code paths.

**Declared but not referenced in application TypeScript (as of scan):**
- `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` — listed in `package.json`; no imports found under `src/` or `scripts/`. Treat as optional future object storage or removable if unused.

## Configuration

**Environment:**
- Variables consumed across the app; production hard requirements validated in `src/lib/env.server.ts` (`assertProductionEnvOrThrow`), invoked from `src/instrumentation.ts` on startup.
- Do not commit `.env`; local Postgres reference: `docker-compose.yml` (Postgres 15 service on host port `5434`).

**Build:**
- `next.config.ts` — Next.js.
- `tsconfig.json` — `strict`, path aliases `@/*`, `@core/*`, `@shared/*`, `@modules/*` → `src/`.
- `tsconfig.scripts.json` — CommonJS module mode for Node scripts.

## Platform Requirements

**Development:**
- Node.js compatible with Next.js 16 and Prisma 6.
- PostgreSQL reachable via `DATABASE_URL` (local option: `docker-compose.yml`).

**Production:**
- Node hosting compatible with Next.js (e.g. Vercel or Node server); `VERCEL_URL` is referenced as a URL fallback in `src/lib/security/allowed-origins.ts` and `src/app/restaurant/tables/qr/[tableId]/page.tsx`.

---

*Stack analysis: 2025-03-27*
