import { badgeClasses, cardClasses } from "@/lib/ui/button-variants";
import { resolveTenantSetupProgress } from "@/core/tenancy/setup-progress";
import {
  getSetupStatusLabel,
  getSetupStepPresentation,
  sortSetupStepsForDisplay,
} from "@/modules/onboarding/lib/setup-presenter";

function formatDate(value: Date | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export async function HqTenantSetupPanel({ tenantId }: { tenantId: number }) {
  const setup = await resolveTenantSetupProgress(tenantId);
  const steps = sortSetupStepsForDisplay(setup.steps);

  return (
    <section className={cardClasses({ className: "p-4" })}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--ui-text-primary)]">Kurulum ve Canliya Hazirlik</h3>
          <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
            Bu tenantin onboarding ilerlemesi ve canliya alma blokajlari.
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs uppercase tracking-wide text-[var(--ui-text-secondary)]">Kurulum Tamamlama</p>
          <p className="text-lg font-semibold text-[var(--ui-text-primary)]">
            %{setup.completionPercent} ({setup.requiredCompletedCount}/{setup.requiredTotalCount})
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className={badgeClasses(setup.goLiveReady ? "success" : "warning")}>
          {setup.goLiveReady ? "Canliya Hazir" : "Canliya Hazir Degil"}
        </span>
        <span className={badgeClasses("neutral")}>Lifecycle: {setup.lifecycleStatus}</span>
        {setup.setupStep ? <span className={badgeClasses("neutral")}>Step: {setup.setupStep}</span> : null}
      </div>

      {setup.blockers.length > 0 ? (
        <div className={cardClasses({ tone: "warning", className: "mt-3 p-3" })}>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-warning)]">
            Kritik Blokajlar
          </p>
          <ul className="mt-2 space-y-1 text-sm text-[var(--ui-text-primary)]">
            {setup.blockers.map((blocker) => (
              <li key={blocker}>- {blocker}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--ui-border)] text-xs uppercase tracking-wide text-[var(--ui-text-secondary)]">
              <th className="px-2 py-2 text-left">Adim</th>
              <th className="px-2 py-2 text-left">Durum</th>
              <th className="px-2 py-2 text-left">Tip</th>
              <th className="px-2 py-2 text-left">Tamamlanma</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => {
              const presentation = getSetupStepPresentation(step.code);
              return (
                <tr key={step.code} className="border-b border-[var(--ui-border)]/70 align-top">
                  <td className="px-2 py-2">
                    <p className="font-medium text-[var(--ui-text-primary)]">{presentation.title}</p>
                    <p className="mt-1 text-xs text-[var(--ui-text-secondary)]">
                      {presentation.description}
                    </p>
                    {step.blocker ? (
                      <p className="mt-1 text-xs text-[var(--ui-danger)]">{step.blocker}</p>
                    ) : null}
                  </td>
                  <td className="px-2 py-2">
                    <span className={badgeClasses(step.completed ? "success" : step.required ? "warning" : "neutral")}>
                      {getSetupStatusLabel(step)}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-xs text-[var(--ui-text-secondary)]">
                    {step.required ? "Zorunlu" : "Opsiyonel"}
                  </td>
                  <td className="px-2 py-2 text-xs text-[var(--ui-text-secondary)]">
                    {formatDate(step.completedAt)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
