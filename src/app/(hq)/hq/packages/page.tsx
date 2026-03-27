import { cardClasses } from "@/lib/ui/button-variants";
import { HqPackageCreateForm } from "@/modules/hq/components/hq-package-create-form";
import { HqPackageList } from "@/modules/hq/components/hq-package-list";
import { HqPackageSettingsForm } from "@/modules/hq/components/hq-package-settings-form";
import { getHqPackagesPageData } from "@/modules/hq/server/package-queries";

export default async function HqPackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ planId?: string }>;
}) {
  const params = await searchParams;
  const selectedPlanId = Number.parseInt(params.planId ?? "", 10);
  const data = await getHqPackagesPageData(Number.isFinite(selectedPlanId) ? selectedPlanId : null);

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <h2 className="text-xl font-semibold text-[var(--ui-text-primary)]">Paket Ayarlari</h2>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
          Tenant planlarini merkezi olarak olusturun, aktif/pasif yonetin, feature ve limit seviyesinde duzenleyin.
        </p>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Yeni Paket Olustur</h3>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
          Teknik kod kontrollu secilir; display name istediginiz gibi degistirilebilir.
        </p>
        <div className="mt-3">
          <HqPackageCreateForm availableCodes={data.availableCodesForCreate.map(String)} />
        </div>
      </section>

      <HqPackageList packages={data.packages} selectedPlanId={data.selectedPackage?.id ?? null} />

      {data.selectedPackage ? (
        <HqPackageSettingsForm item={data.selectedPackage} />
      ) : (
        <section className={cardClasses({ className: "p-4" })}>
          <p className="text-sm text-[var(--ui-text-secondary)]">
            Duzenlemek icin listeden bir paket secin.
          </p>
        </section>
      )}
    </div>
  );
}
