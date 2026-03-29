import Link from "next/link";
import { cardClasses, selectClasses, fieldClasses } from "@/lib/ui/button-variants";
import { LifecycleBadge } from "@/modules/hq/components/lifecycle-badge";
import { listHqTenants } from "@/modules/hq/server/tenant-queries";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export default async function HqTenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; plan?: string; deleted?: string }>;
}) {
  const params = await searchParams;
  const tenants = await listHqTenants({
    search: params.q ?? null,
    status: params.status ?? null,
    planCode: params.plan ?? null,
  });

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold text-[var(--ui-text-primary)]">Tenant Listesi</h2>
            <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
              Tum tenantlarin status, plan ve erisim bilgilerini merkezden yonetin.
            </p>
          </div>
          <Link href="/hq/tenants/new" className="text-sm font-medium text-[var(--ui-accent)] hover:underline">
            + Yeni tenant
          </Link>
        </div>
      </section>

      {params.deleted ? (
        <section className={cardClasses({ tone: "success", className: "p-3.5" })}>
          <p className="text-sm text-emerald-900">
            Tenant kalici olarak silindi: <span className="font-semibold">{params.deleted}</span>
          </p>
        </section>
      ) : null}

      <section className={cardClasses({ className: "p-4" })}>
        <form className="grid gap-3 md:grid-cols-4">
          <input
            type="text"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Ad veya slug ara"
            className={fieldClasses()}
          />
          <select name="status" defaultValue={params.status ?? ""} className={selectClasses()}>
            <option value="">Tum Statusler</option>
            <option value="TRIAL">Trial</option>
            <option value="ACTIVE">Aktif</option>
            <option value="PENDING_SETUP">Kurulum Bekliyor</option>
            <option value="SUSPENDED">Askida</option>
            <option value="PAST_DUE">Past Due</option>
          </select>
          <select name="plan" defaultValue={params.plan ?? ""} className={selectClasses()}>
            <option value="">Tum Planlar</option>
            <option value="MINI">MINI</option>
            <option value="RESTAURANT">RESTAURANT</option>
            <option value="CORPORATE">CORPORATE</option>
          </select>
          <button
            type="submit"
            className="rounded-xl bg-[var(--ui-accent)] px-4 py-2 text-sm font-semibold text-white"
          >
            Filtrele
          </button>
        </form>
      </section>

      <section className={cardClasses({ className: "p-0" })}>
        {tenants.length === 0 ? (
          <div className="p-6 text-sm text-[var(--ui-text-secondary)]">
            Filtreye uygun tenant bulunamadi.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] text-xs uppercase tracking-wide text-[var(--ui-text-secondary)]">
                  <th className="px-4 py-3">Tenant</th>
                  <th className="px-4 py-3">Slug / Domain</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Plan</th>
                  <th className="px-4 py-3">Olusturma</th>
                  <th className="px-4 py-3">Kullanim</th>
                  <th className="px-4 py-3">Detay</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((tenant) => (
                  <tr key={tenant.id} className="border-b border-[var(--ui-border)]/70 align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--ui-text-primary)]">{tenant.name}</p>
                      <p className="text-xs text-[var(--ui-text-secondary)]">#{tenant.id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{tenant.slug}</p>
                      <p className="text-xs text-[var(--ui-text-secondary)]">
                        {tenant.primaryDomain ?? "Primary domain yok"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <LifecycleBadge status={tenant.lifecycleStatus} />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{tenant.planCode}</p>
                      <p className="text-xs text-[var(--ui-text-secondary)]">{tenant.planName}</p>
                    </td>
                    <td className="px-4 py-3">{formatDate(tenant.createdAt)}</td>
                    <td className="px-4 py-3">{tenant.restaurantsCount} restoran</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/hq/tenants/${tenant.id}`}
                        className="font-medium text-[var(--ui-accent)] hover:underline"
                      >
                        Tenant detay
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
