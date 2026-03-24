# Core

This folder is the stable backbone for cross-module rules.

Owns:
- auth/session validation
- tenancy resolution and context propagation
- permissions and role checks
- entitlements and plan limits
- audit and security helpers
- billing integrity rules
- surface guard contracts for server actions and API routes

Rule:
- Domain workflows must stay in modules.
- Core can expose policies/services, but should not own module-specific UI.
