type Props = {
  startsAt: Date;
  endsAt: Date;
  message: string;
};

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

export function GlobalMaintenanceScreen({ startsAt, endsAt, message }: Props) {
  return (
    <div className="maintenance-screen min-h-screen px-4 py-10">
      <div className="maintenance-card mx-auto w-full max-w-2xl rounded-2xl border border-[var(--ui-border)] p-6 shadow-sm">
        <div className="maintenance-robot-wrap mx-auto mb-5 flex h-40 w-40 items-center justify-center rounded-full">
          <div className="maintenance-robot" aria-hidden>
            <span className="maintenance-robot-emoji">🤖</span>
            <span className="maintenance-wrench">🔧</span>
          </div>
        </div>

        <p className="text-center text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ui-text-secondary)]">
          Planli Bakim
        </p>
        <h1 className="mt-2 text-center text-2xl font-semibold text-[var(--ui-text-primary)]">
          Sistem gecici olarak bakim modunda
        </h1>

        <dl className="mt-5 grid gap-2 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] p-4 text-sm">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[var(--ui-text-secondary)]">Baslangic</dt>
            <dd className="font-medium text-[var(--ui-text-primary)]">{formatDate(startsAt)}</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-[var(--ui-text-secondary)]">Bitis</dt>
            <dd className="font-medium text-[var(--ui-text-primary)]">{formatDate(endsAt)}</dd>
          </div>
        </dl>

        {message ? (
          <p className="mt-4 rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] p-4 text-sm leading-relaxed text-[var(--ui-text-primary)]">
            {message}
          </p>
        ) : null}
      </div>
    </div>
  );
}
