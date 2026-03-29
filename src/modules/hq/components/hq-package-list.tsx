import Link from "next/link";
import { badgeClasses, cardClasses } from "@/lib/ui/button-variants";
import type { HqPackageListItem } from "@/modules/hq/server/package-queries";

type HqPackageListProps = {
  packages: HqPackageListItem[];
  selectedPlanId: number | null;
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function HqPackageList({ packages, selectedPlanId }: HqPackageListProps) {
  return (
    <section className={cardClasses({ className: "p-0" })}>
      {packages.length === 0 ? (
        <div className="p-5 text-sm text-[var(--ui-text-secondary)]">Paket bulunamadi.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] text-xs uppercase tracking-wide text-[var(--ui-text-secondary)]">
                <th className="px-4 py-3">Paket</th>
                <th className="px-4 py-3">Durum</th>
                <th className="px-4 py-3">Feature</th>
                <th className="px-4 py-3">Limit Ozeti</th>
                <th className="px-4 py-3">Tenant</th>
                <th className="px-4 py-3">Guncelleme</th>
                <th className="px-4 py-3">Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((item) => {
                const active = item.id === selectedPlanId;
                return (
                  <tr
                    key={item.id}
                    className={`border-b border-[var(--ui-border)]/70 align-top ${active ? "bg-[var(--ui-surface-subtle)]/70" : ""}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-[var(--ui-text-primary)]">{item.displayName}</p>
                      <p className="text-xs text-[var(--ui-text-secondary)]">
                        Kod: <span className="font-medium">{item.code}</span>
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={badgeClasses(item.isActive ? "success" : "neutral")}>
                        {item.isActive ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{item.featureCount}</td>
                    <td className="px-4 py-3 text-xs text-[var(--ui-text-secondary)]">{item.limitSummary}</td>
                    <td className="px-4 py-3">{item.tenantCount}</td>
                    <td className="px-4 py-3">
                      <p>{formatDate(item.updatedAt)}</p>
                      <p className="text-xs text-[var(--ui-text-secondary)]">Olusturma: {formatDate(item.createdAt)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/hq/packages?planId=${item.id}`} className="font-medium text-[var(--ui-accent)] hover:underline">
                        Duzenle
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
