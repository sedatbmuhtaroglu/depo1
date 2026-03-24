# ADR-0003: HQ Control Actions V1

Date: 2026-03-23  
Status: Accepted

## Scope

This phase upgrades HQ from read/status MVP to first actionable control plane:
- tenant provisioning
- tenant plan change
- tenant feature override
- tenant limit override
- effective entitlement enforcement

## Key Decisions

1. Keep single-repo modular monolith; no deploy split yet.
2. Use existing core guard stack (`authz + lifecycle + surface guard`) for every HQ mutation.
3. Persist limit overrides in a dedicated model (`TenantLimitOverride`).
4. Extend `FeatureCode` for HQ-manageable product modules (`INVOICING`, `ADVANCED_REPORTS`, `KITCHEN_DISPLAY`, `ANALYTICS`).
5. Keep tenant persisted status enum compatibility (`ACTIVE/SUSPENDED/EXPIRED`) and map lifecycle statuses via setup progress (`TRIAL/PENDING_SETUP`).

## First Real Enforcement

- `WAITER_CALL` feature toggle blocks waiter-call flow.
- `CUSTOM_DOMAIN` feature toggle blocks domain mutations.
- `INVOICING` feature toggle blocks invoicing screen.
- `KITCHEN_DISPLAY` feature toggle blocks kitchen panel.
- user/product/table/menu limits now resolve from effective entitlements (plan + env + tenant override).

## Deferred

- full billing/subscription engine
- support CRM and complete audit timeline
- separate deploy/runtime split
- full onboarding wizard
