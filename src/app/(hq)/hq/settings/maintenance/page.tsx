import { cardClasses } from "@/lib/ui/button-variants";
import { PlannedMaintenanceForm } from "@/modules/hq/components/planned-maintenance-form";
import { getPlannedMaintenanceSettingsForHq } from "@/modules/content/server/content-queries";

export default async function HqMaintenanceSettingsPage() {
  const settings = await getPlannedMaintenanceSettingsForHq();

  if (!settings) {
    return (
      <section className={cardClasses({ className: "p-5" })}>
        <h2 className="text-xl font-semibold text-[var(--ui-text-primary)]">Planli bakim</h2>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">Bakim ayarlari yuklenemedi.</p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <h2 className="text-xl font-semibold text-[var(--ui-text-primary)]">Planli bakim</h2>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
          Bu ekrandaki checkbox konumu: <strong>HQ &gt; Icerik &gt; Planli bakim</strong>. Kayit
          sonrasinda sadece izinli yol listesinde olmayan sayfalarda robotlu bakim gorunumu
          yayinlanir.
        </p>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <PlannedMaintenanceForm initial={settings} />
      </section>
    </div>
  );
}
