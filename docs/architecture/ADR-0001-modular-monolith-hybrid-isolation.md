# ADR-0001: Modular Monolith + Hybrid Isolation (Incremental)

Date: 2026-03-23  
Status: Accepted (initial skeleton)

## Decision

The repository stays single-repo and single Next.js app for now, but is organized as modular monolith bounded contexts:

1. marketing
2. hq
3. restaurant-ops
4. waiter
5. kitchen
6. storefront
7. core/shared

Isolation strategy is hybrid:
- strict logical boundaries now (routes, modules, policies)
- future-ready separation points for independent deploy/runtime

## Why

- Avoid big-bang rewrite risk.
- Keep current production flows stable.
- Reduce blast radius from public surfaces (especially marketing/storefront).
- Prepare HQ control plane without breaking tenant operations.

## Route Segmentation Target

Canonical route groups (without changing public URLs immediately):
- `/(marketing)` -> public web
- `/(hq)` -> central control plane
- `/(ops)` -> manager/auth/staff
- `/(waiter)` -> waiter surface
- `/(kitchen)` -> kitchen surface
- `/(storefront)` -> customer ordering surface

Current URLs remain valid:
- `/restaurant/*`, `/waiter`, `/kitchen`, `/m/*`, `/menu/*`, `/payment/*`, `/order-success/*`

## Boundary Rules

- `core`: auth, tenancy, permissions, entitlements, audit/security, billing invariants.
- `shared`: UI kit, tokens, generic helpers/types only.
- `modules/*`: business workflows and surface-specific orchestration.

Do not:
- put domain logic into `shared`
- allow marketing to call tenant mutations directly
- allow module-to-module direct coupling outside approved contracts

## Deployment Readiness (Future)

Strong candidates for separate runtime/deploy:
- marketing (public edge, minimal trusted surface)
- storefront (public but tenant-scoped, high traffic)
- app plane (restaurant-ops + waiter + kitchen, authenticated)
- hq (internal/privileged)

Keep single deploy now; enforce boundaries first.

## Migration Plan

### P0 (now)
- Add architecture contract (`core/routing`, `core/architecture`, `modules/*` docs).
- Tag request surface in middleware (`x-app-surface`).
- Keep existing routes and imports working.

### P1
- Move new features to `src/modules/*` first (strangler approach).
- Introduce module-scoped actions/services entry points.
- Start route-group wrappers for new surfaces (`(hq)`, `(ops)`, etc.).
- Centralize entitlement and permission checks into core services.

### P2
- Gradually migrate legacy `src/app/actions/*` and `src/lib/*` into module/core layers.
- Add import-boundary lint rules and CI checks.
- Split runtime/deploy per surface when operationally justified.

## Fail-Closed Defaults

- Missing tenant context => reject privileged operations.
- Unknown surface => no implicit tenant header.
- Cross-tenant actions must be explicit HQ policy paths only.
