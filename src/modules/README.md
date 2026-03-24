# Modules

`src/modules` defines bounded contexts for the modular monolith target.

Planned modules:
- marketing
- hq
- restaurant-ops
- waiter
- kitchen
- storefront

Current strategy:
- Keep existing routes/services intact.
- Add boundaries first.
- Move feature slices incrementally (no big-bang refactor).
