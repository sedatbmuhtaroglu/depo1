# ADR-0002: Core Authz + Entitlements + Tenant Lifecycle + Surface Guard

Date: 2026-03-23  
Status: Accepted (phase-1 foundation)

## Context

Before HQ screens, the app needs a fail-closed core answering:
- who can do what
- what each tenant can use
- which lifecycle status can access which surfaces
- how server actions and API routes enforce a shared guard model

## Decision

Added central core layers:

1. `src/core/authz/*`
- actor model (`STAFF`, `HQ_ADMIN`, `STOREFRONT_GUEST`, `SYSTEM`, `ANONYMOUS`)
- capability model and role-to-capability mapping
- capability assertion helpers

2. `src/core/entitlements/*`
- tenant entitlement snapshot (`features + limits + lifecycle`)
- plan defaults with env overrides
- `hasFeature`, `assertFeatureEnabled`, `getLimit`, `assertWithinLimit`

3. `src/core/tenancy/lifecycle-policy.ts`
- normalized lifecycle statuses:
  - `DRAFT`, `PENDING_SETUP`, `TRIAL`, `ACTIVE`, `PAST_DUE`, `SUSPENDED`, `CANCELED`
- compatibility mapping from existing persisted statuses (`ACTIVE`, `SUSPENDED`, `EXPIRED`)
- centralized surface access rules by lifecycle

4. `src/core/surfaces/*`
- security surface taxonomy
- app-surface to security-surface mapping
- reusable `assertSurfaceGuard` for server-side guards

## First Integrations

- Panel entry guards:
  - `requireManagerSession`
  - `requireWaiterOrManagerSession`
  - `requireKitchenOrManagerSession`

- Server actions:
  - `staff-users` mutations (capability + lifecycle + limit check)
  - `update-restaurant-settings` (capability + lifecycle)
  - `tenant-domain` (capability + lifecycle + entitlement feature check)

- API:
  - `POST /api/table-session/waiter-call` guarded via surface guard
  - waiter request core enforces lifecycle + entitlement (`WAITER_CALL`)

## Guarding Philosophy

- fail-closed at guard entry points
- keep legacy routes/flows stable
- migrate incrementally, not big bang
- old helpers may stay temporarily; new integrations must bind to core guard model
