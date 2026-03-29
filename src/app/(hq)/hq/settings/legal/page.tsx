import { cardClasses } from "@/lib/ui/button-variants";
import { HqLegalPagesForm } from "@/modules/hq/components/hq-legal-pages-form";
import { getLegalPublicPagesMerged } from "@/modules/marketing/server/legal-public-pages";

export default async function HqLegalPagesSettingsPage() {
  const initial = await getLegalPublicPagesMerged();

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <h2 className="text-xl font-semibold text-[var(--ui-text-primary)]">Yasal metinler</h2>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
          Kullanici sozlesmesi, KVKK aydinlatma ve gizlilik politikasini duzenleyin. Kayit sonrasi{" "}
          <code className="rounded bg-[var(--ui-surface-muted)] px-1 text-xs">/legal/*</code> sayfalari
          guncellenir.
        </p>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <HqLegalPagesForm initial={initial} />
      </section>
    </div>
  );
}
