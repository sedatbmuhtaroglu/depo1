# PII Backfill and Deletion Plan (Non-Destructive Phase)

## Scope

This phase prepares migration away from legacy plaintext PII without destructive schema changes.

Target models:

- `SalesLead`
- `MarketingFormSubmission`
- `TenantStaff`

Target fields:

- `email` -> `emailEncrypted` + `emailHash` + `emailMasked`
- `phone` -> `phoneEncrypted` + `phoneHash` + `phoneLast4`
- `contactName` (lead-like models) -> `contactNameEncrypted` + `contactNameHash` + `contactNameMasked`

## Current Safety Posture

- Writes already use encrypted+hash packing helpers (`packLeadLikePii`, `packStaffPii`).
- Reads keep a guarded plaintext fallback in `pii-read.ts`.
- Plaintext fallback can be disabled by setting `PII_PLAINTEXT_READ_MODE=strict`.

## Backfill Execution

Dry-run first:

```bash
npm run pii:backfill
```

Write mode:

```bash
npm run pii:backfill:write
```

Optional model targeting:

```bash
npm run pii:backfill -- --model=salesLead
npm run pii:backfill:write -- --model=tenantStaff
```

The script only fills encrypted/hash/masked columns and does **not** null plaintext columns in this phase.

## Next Phase (Destructive / Controlled)

1. Run write backfill in production with monitoring.
2. Verify zero-legacy reads in logs (`Legacy plaintext PII fallback used`).
3. Enable `PII_PLAINTEXT_READ_MODE=strict`.
4. Add migration to set plaintext columns to `NULL` in batches.
5. Remove plaintext read fallback branches from `pii-read.ts`.
6. Drop plaintext columns after retention/legal approval.

