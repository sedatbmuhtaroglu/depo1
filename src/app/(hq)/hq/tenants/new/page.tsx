import Link from "next/link";
import { cardClasses } from "@/lib/ui/button-variants";
import { CreateTenantForm } from "@/modules/hq/components/create-tenant-form";
import { listActivePlans } from "@/modules/hq/server/tenant-queries";

export default async function HqCreateTenantPage() {
  const plans = await listActivePlans();

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
              Provisioning
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--ui-text-primary)]">
              Yeni Tenant Olustur
            </h2>
            <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
              HQ uzerinden yeni tenant provisioning islemi.
            </p>
          </div>
          <Link href="/hq/tenants" className="text-sm font-medium text-[var(--ui-accent)] hover:underline">
            Tenant listesine don
          </Link>
        </div>
      </section>

      <section className={cardClasses({ className: "p-5" })}>
        <CreateTenantForm plans={plans} />
      </section>
    </div>
  );
}
