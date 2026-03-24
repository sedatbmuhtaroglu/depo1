# ADR-0004 - Sales Pipeline + Trial Conversion V1

Date: 2026-03-23

## Context
- HQ tarafinda tenant provisioning ve lifecycle kontrolu mevcut.
- Satis hattinda lead -> trial -> won akisi merkezi ve izlenebilir degildi.
- Tam bir CRM degil, calisan bir sales control plane omurgasi gerekiyordu.

## Decision
- Minimal persistence:
  - `SalesLead` (lead kaydi, status/source, tenant baglantisi, conversion zamanlari)
  - `SalesLeadEvent` (lead seviyesinde audit-friendly olay kaydi)
- HQ icinde iki yeni ekran:
  - `/hq/leads` (pipeline listesi + manuel lead create)
  - `/hq/leads/[leadId]` (lead detail + status + conversion aksiyonlari)
- Lead mutationlari icin yeni capability seti:
  - `SALES_LEAD_MANAGE`
  - `SALES_TRIAL_CONVERT`
- Lead -> trial tenant olusturma, mevcut tenant provisioning mantigina ortak helper ile baglandi:
  - `provisionTenantTx` / `provisionTenant`
- Trial -> active (WON) donusumu:
  - tenant plan update
  - lifecycle ACTIVE patch
  - lead status WON
  - tenant audit + lead event kaydi
- Onboarding baglantisi:
  - Lead detail, bagli tenant icin mevcut setup resolver sonucunu reuse eder.

## Consequences
- HQ artik satis hattini tenant yasam dongusuyle birlikte yonetebilir.
- Lead tarafinda tenant disi olaylar icin `SalesLeadEvent` audit izi mevcut.
- Public lead capture, task assignment, full CRM timeline ve billing entegre abonelik su asamada kapsam disi kaldı.
