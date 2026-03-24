import Link from "next/link";
import { badgeClasses, buttonClasses, cardClasses } from "@/lib/ui/button-variants";
import { resolveTenantSetupProgress } from "@/core/tenancy/setup-progress";
import {
  getSetupStatusLabel,
  getSetupStepPresentation,
  sortSetupStepsForDisplay,
} from "@/modules/onboarding/lib/setup-presenter";

export async function TenantSetupChecklist({ tenantId }: { tenantId: number }) {
  const setup = await resolveTenantSetupProgress(tenantId);
  const steps = sortSetupStepsForDisplay(setup.steps);

  return (
    <section className={cardClasses({ tone: setup.goLiveReady ? "success" : "warning", className: "p-4" })}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
            Isletme Kurulum Kontrol Listesi
          </p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--ui-text-primary)]">
            {setup.goLiveReady ? "Canliya cikmaya hazirsiniz" : "Kurulum adimlari devam ediyor"}
          </h2>
          <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
            Tamamlanan zorunlu adim: {setup.requiredCompletedCount}/{setup.requiredTotalCount} (
            %{setup.completionPercent})
          </p>
        </div>
        <span className={badgeClasses(setup.goLiveReady ? "success" : "warning")}>
          {setup.goLiveReady ? "Ready for Go-Live" : "Aksiyon Gerekli"}
        </span>
      </div>

      {setup.blockers.length > 0 ? (
        <div className={cardClasses({ tone: "warning", className: "mt-3 p-3 shadow-none" })}>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-warning)]">
            Canliya Alma Oncesi Tamamlanacaklar
          </p>
          <ul className="mt-2 space-y-1 text-sm text-[var(--ui-text-primary)]">
            {setup.blockers.map((blocker) => (
              <li key={blocker}>- {blocker}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {steps.map((step) => {
          const presentation = getSetupStepPresentation(step.code);
          return (
            <article
              key={step.code}
              className={cardClasses({
                tone: step.completed ? "subtle" : step.required ? "warning" : "default",
                className: "px-3 py-2.5 shadow-none",
              })}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-[var(--ui-text-primary)]">{presentation.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--ui-text-secondary)]">{presentation.description}</p>
                  {step.blocker ? (
                    <p className="mt-1 text-xs text-[var(--ui-danger)]">{step.blocker}</p>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={badgeClasses(step.completed ? "success" : step.required ? "warning" : "neutral")}>
                    {getSetupStatusLabel(step)}
                  </span>
                  {!step.completed && presentation.actionHref && presentation.actionLabel ? (
                    <Link
                      href={presentation.actionHref}
                      className={buttonClasses({
                        variant: "outline",
                        size: "xs",
                        className: "px-2.5",
                      })}
                    >
                      {presentation.actionLabel}
                    </Link>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
