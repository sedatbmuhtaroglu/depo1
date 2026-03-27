import type { Prisma } from "@prisma/client";
import { blindIndexHexOrNull } from "@/lib/pii/pii-blind-index";
import { normalizeEmailForPii, normalizePhoneForPii } from "@/lib/pii/pii-normalize";

/** Exact-match PII lookup via blind index + legacy plaintext contains (until backfill removes plaintext). */
export function buildSalesLeadSearchOr(search: string): Prisma.SalesLeadWhereInput[] {
  const or: Prisma.SalesLeadWhereInput[] = [
    { businessName: { contains: search, mode: "insensitive" } },
    { contactName: { contains: search, mode: "insensitive" } },
    { email: { contains: search, mode: "insensitive" } },
    { phone: { contains: search, mode: "insensitive" } },
  ];

  const e = normalizeEmailForPii(search);
  const eh = e ? blindIndexHexOrNull("email", e) : null;
  if (eh) or.push({ emailHash: eh });

  const p = normalizePhoneForPii(search);
  const ph = p ? blindIndexHexOrNull("phone", p) : null;
  if (ph) or.push({ phoneHash: ph });

  return or;
}

export function buildMarketingSubmissionSearchOr(search: string): Prisma.MarketingFormSubmissionWhereInput[] {
  const or: Prisma.MarketingFormSubmissionWhereInput[] = [
    { businessName: { contains: search, mode: "insensitive" } },
    { contactName: { contains: search, mode: "insensitive" } },
    { email: { contains: search, mode: "insensitive" } },
    { phone: { contains: search, mode: "insensitive" } },
    { message: { contains: search, mode: "insensitive" } },
  ];

  const e = normalizeEmailForPii(search);
  const eh = e ? blindIndexHexOrNull("email", e) : null;
  if (eh) or.push({ emailHash: eh });

  const p = normalizePhoneForPii(search);
  const ph = p ? blindIndexHexOrNull("phone", p) : null;
  if (ph) or.push({ phoneHash: ph });

  return or;
}
