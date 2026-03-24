import { badgeClasses } from "@/lib/ui/button-variants";
import {
  getLifecycleBadgeVariant,
  getLifecycleLabel,
} from "@/modules/hq/server/tenant-status";
import type { TenantLifecycleStatus } from "@/core/tenancy/lifecycle-policy";

type LifecycleBadgeProps = {
  status: TenantLifecycleStatus;
  className?: string;
};

export function LifecycleBadge({ status, className }: LifecycleBadgeProps) {
  return (
    <span className={badgeClasses(getLifecycleBadgeVariant(status), className)}>
      {getLifecycleLabel(status)}
    </span>
  );
}
