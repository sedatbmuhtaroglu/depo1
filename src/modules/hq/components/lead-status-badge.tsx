import type { SalesLeadStatus } from "@prisma/client";
import { badgeClasses } from "@/lib/ui/button-variants";
import {
  getSalesLeadStatusBadgeVariant,
  getSalesLeadStatusLabel,
} from "@/modules/hq/server/lead-status";

export function LeadStatusBadge({ status }: { status: SalesLeadStatus }) {
  return (
    <span className={badgeClasses(getSalesLeadStatusBadgeVariant(status))}>
      {getSalesLeadStatusLabel(status)}
    </span>
  );
}
