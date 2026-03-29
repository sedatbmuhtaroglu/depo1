import type { MarketingSubmissionSource } from "@prisma/client";
import Link from "next/link";
import { cardClasses, fieldClasses, selectClasses } from "@/lib/ui/button-variants";
import { listMarketingSubmissions } from "@/modules/hq/server/marketing-queries";

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

function getStatusLabel(status: "RECEIVED" | "LEAD_CREATED" | "LEAD_CREATE_FAILED" | "SPAM_REJECTED") {
  if (status === "RECEIVED") return "Alindi";
  if (status === "LEAD_CREATED") return "Lead Olustu";
  if (status === "LEAD_CREATE_FAILED") return "Lead Baglanamadi";
  return "Spam / Reddedildi";
}

function getSourceLabel(source: MarketingSubmissionSource) {
  if (source === "LANDING_HOMEPAGE") return "Landing ana sayfa";
  if (source === "LANDING_CTA") return "Landing CTA";
  if (source === "LANDING_FOOTER") return "Landing alt bilgi";
  if (source === "LANDING_PUBLIC_CONTACT") return "Iletisim formu";
  return source;
}

function truncateNote(text: string | null, max = 100) {
  if (!text) return "—";
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…`;
}

export default async function HqMarketingSubmissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const submissions = await listMarketingSubmissions({
    q: params.q ?? null,
    status: params.status ?? null,
  });

  return (
    <div className="space-y-4">
      <section className={cardClasses({ className: "p-5" })}>
        <h2 className="text-xl font-semibold text-[var(--ui-text-primary)]">Form Basvurulari</h2>
        <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">
          Landing sayfasindan gelen tum basvurulari, lead eslesmesiyle birlikte izleyin.
        </p>
      </section>

      <section className={cardClasses({ className: "p-4" })}>
        <form className="grid gap-3 md:grid-cols-4">
          <input
            type="text"
            name="q"
            defaultValue={params.q ?? ""}
            placeholder="Ad, isletme, telefon, not ara"
            className={fieldClasses()}
          />
          <select name="status" defaultValue={params.status ?? ""} className={selectClasses()}>
            <option value="">Tum durumlar</option>
            <option value="RECEIVED">Alindi</option>
            <option value="LEAD_CREATED">Lead Olustu</option>
            <option value="LEAD_CREATE_FAILED">Lead Baglanamadi</option>
            <option value="SPAM_REJECTED">Spam / Reddedildi</option>
          </select>
          <button
            type="submit"
            className="rounded-xl bg-[var(--ui-accent)] px-4 py-2 text-sm font-semibold text-white md:col-span-2 md:justify-self-start"
          >
            Filtrele
          </button>
        </form>
      </section>

      <section className={cardClasses({ className: "p-0" })}>
        {submissions.length === 0 ? (
          <div className="p-6 text-sm text-[var(--ui-text-secondary)]">Basvuru bulunamadi.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] text-xs uppercase tracking-wide text-[var(--ui-text-secondary)]">
                  <th className="px-4 py-3">Tarih</th>
                  <th className="px-4 py-3">Kaynak</th>
                  <th className="px-4 py-3">Durum</th>
                  <th className="px-4 py-3">Ad / Isletme</th>
                  <th className="px-4 py-3">Iletisim</th>
                  <th className="px-4 py-3">Not</th>
                  <th className="px-4 py-3">Lead</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((submission) => (
                  <tr key={submission.id} className="border-b border-[var(--ui-border)]/70 align-top">
                    <td className="px-4 py-3">
                      <p>{formatDate(submission.createdAt)}</p>
                      <p className="text-xs text-[var(--ui-text-secondary)]">#{submission.id}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{getSourceLabel(submission.source)}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{getStatusLabel(submission.status)}</p>
                      {submission.failureReason ? (
                        <p className="text-xs text-[var(--ui-text-secondary)]">{submission.failureReason}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{submission.contactName}</p>
                      <p className="text-xs text-[var(--ui-text-secondary)]">{submission.businessName}</p>
                      {submission.city ? (
                        <p className="text-xs text-[var(--ui-text-secondary)]">{submission.city}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-xs text-[var(--ui-text-secondary)]">{submission.phone ?? "-"}</p>
                      <p className="text-xs text-[var(--ui-text-secondary)]">{submission.email ?? "-"}</p>
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <p
                        className="text-xs text-[var(--ui-text-secondary)] line-clamp-3 whitespace-pre-wrap"
                        title={submission.message ?? undefined}
                      >
                        {truncateNote(submission.message)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {submission.leadId ? (
                        <Link
                          href={`/hq/leads/${submission.leadId}`}
                          className="font-medium text-[var(--ui-accent)] hover:underline"
                        >
                          Lead #{submission.leadId}
                        </Link>
                      ) : (
                        <p className="text-xs text-[var(--ui-text-secondary)]">Eslesmedi</p>
                      )}
                      {submission.leadSource ? (
                        <p className="text-xs text-[var(--ui-text-secondary)]">{submission.leadSource}</p>
                      ) : null}
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
