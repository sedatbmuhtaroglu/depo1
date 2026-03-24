# storefront module

Scope:
- QR entry, table session, menu browsing, customer ordering/payment

Hard boundary:
- treated as a public attack surface
- only minimum required endpoints/actions are reachable
- must fail-closed when tenant/session context is missing
