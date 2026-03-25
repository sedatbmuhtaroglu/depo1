import React from "react";
import { requireManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import {
  listTenantSecurityEvents,
  SecurityEventRange,
  SecurityEventRiskLevelFilter,
} from "@/lib/security/security-events";
import {
  formatSecurityDateCompact,
  formatSecurityDateFull,
  formatSecurityTableRef,
  getRiskLevelLabel,
  getSecurityActionLabel,
  getSecurityDecisionLabel,
  getSecurityEventTypeLabel,
  getSecurityReasonLabel,
} from "@/lib/security/security-event-ui";
import { badgeClasses, buttonClasses, cardClasses, fieldClasses } from "@/lib/ui/button-variants";

export const dynamic = "force-dynamic";

type SecurityPageSearchParams = {
  range?: string;
  level?: string;
  type?: string;
};

const SECTION_CARD_CLASS = cardClasses({ className: "shadow-none" });

const FILTER_FIELD_CLASS = fieldClasses({ size: "md", className: "h-10 w-full" });

function normalizeRange(value?: string): SecurityEventRange {
  return value === "7d" ? "7d" : "24h";
}

function normalizeRiskLevel(value?: string): SecurityEventRiskLevelFilter {
  if (value === "low" || value === "medium" || value === "high") return value;
  return "all";
}

function normalizeCode(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toUpperCase();
}

function compactIpHash(ipHash: string | null): string {
  if (!ipHash) return "-";
  if (ipHash.length <= 14) return ipHash;
  return `${ipHash.slice(0, 10)}...`;
}

function rangeLabel(range: SecurityEventRange): string {
  return range === "7d" ? "Son 7 gün" : "Son 24 saat";
}

function riskBadgeClass(level: "low" | "medium" | "high") {
  if (level === "high") return badgeClasses("danger");
  if (level === "medium") return badgeClasses("warning");
  return badgeClasses("success");
}

export default async function RestaurantSecurityPage({
  searchParams,
}: {
  searchParams: Promise<SecurityPageSearchParams>;
}) {
  await requireManagerSession();
  const { tenantId } = await getCurrentTenantOrThrow();

  const params = await searchParams;
  const range = normalizeRange(params.range);
  const riskLevel = normalizeRiskLevel(params.level);
  const eventType = params.type?.trim() || "all";

  const [{ events, eventTypes }, last24hSnapshot] = await Promise.all([
    listTenantSecurityEvents({
      tenantId,
      range,
      riskLevel,
      eventType,
      limit: 50,
    }),
    listTenantSecurityEvents({
      tenantId,
      range: "24h",
      riskLevel: "all",
      eventType: "all",
      limit: 50,
    }),
  ]);

  const last24hTotal = last24hSnapshot.events.length;

  const blockedDecisions = new Set(["BLOCK", "AUTO_BLOCK"]);
  const blockedTotal = events.filter((event) =>
    blockedDecisions.has(normalizeCode(event.decision)),
  ).length;
  const reviewTotal = events.filter((event) => normalizeCode(event.decision) === "REVIEW").length;

  const eventTypeCount = new Map<string, number>();
  for (const event of events) {
    const typeCode = normalizeCode(event.type) || "UNKNOWN";
    eventTypeCount.set(typeCode, (eventTypeCount.get(typeCode) ?? 0) + 1);
  }

  const topEvent = Array.from(eventTypeCount.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;
  const topEventCode = topEvent?.[0] ?? null;
  const topEventFrequency = topEvent?.[1] ?? 0;
  const topEventLabel = topEventCode ? getSecurityEventTypeLabel(topEventCode) : "Veri yok";

  const selectedEventTypeLabel =
    eventType === "all"
      ? "Tüm event tipleri"
      : getSecurityEventTypeLabel(eventType);

  const selectedRiskLabel =
    riskLevel === "all"
      ? "Tüm risk seviyeleri"
      : getRiskLevelLabel(riskLevel);

  return (
    <div className="space-y-5">
      <section className={cardClasses({ className: "p-5 shadow-none" })}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
              Güvenlik İzleme Paneli
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[color:var(--ui-text-primary)]">Güvenlik Olayları</h2>
            <p className="mt-1 text-sm text-[color:var(--ui-text-secondary)]">
              Şüpheli aksiyonları, risk seviyelerini ve alınan kararları operasyonel bir görünümle
              takip edin.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] px-2.5 py-1 text-xs font-medium text-[color:var(--ui-text-secondary)]">
              Aralık: {rangeLabel(range)}
            </span>
            <span className="inline-flex items-center rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] px-2.5 py-1 text-xs font-medium text-[color:var(--ui-text-secondary)]">
              Risk: {selectedRiskLabel}
            </span>
          </div>
        </div>
      </section>

      <section className={`${SECTION_CARD_CLASS} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Filtre ve Kontrol Merkezi</h3>
            <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
              Olay akışını zaman aralığı, risk seviyesi ve event tipine göre daraltın.
            </p>
          </div>
          <span
            className="inline-flex max-w-full items-center truncate rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] px-2.5 py-1 text-xs font-medium text-[color:var(--ui-text-secondary)]"
            title={`Seçili event tipi: ${selectedEventTypeLabel}`}
          >
            {selectedEventTypeLabel}
          </span>
        </div>

        <form className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <label htmlFor="security-range" className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">
              Zaman aralığı
            </label>
            <select id="security-range" name="range" defaultValue={range} className={FILTER_FIELD_CLASS}>
              <option value="24h">Son 24 saat</option>
              <option value="7d">Son 7 gün</option>
            </select>
          </div>
          <div>
            <label htmlFor="security-level" className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">
              Risk seviyesi
            </label>
            <select
              id="security-level"
              name="level"
              defaultValue={riskLevel}
              className={FILTER_FIELD_CLASS}
            >
              <option value="all">Tüm risk seviyeleri</option>
              <option value="low">Düşük Risk</option>
              <option value="medium">Orta Risk</option>
              <option value="high">Yüksek Risk</option>
            </select>
          </div>
          <div>
            <label htmlFor="security-type" className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">
              Event tipi
            </label>
            <select id="security-type" name="type" defaultValue={eventType} className={FILTER_FIELD_CLASS}>
              <option value="all">Tüm event tipleri</option>
              {eventTypes.map((type) => (
                <option key={type} value={type}>
                  {getSecurityEventTypeLabel(type)}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className={buttonClasses({
                variant: "primary",
                size: "md",
                fullWidth: true,
                className: "h-10 rounded-xl px-4",
              })}
            >
              Uygula
            </button>
          </div>
        </form>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className={cardClasses({ className: "p-3.5 shadow-none" })}>
          <p className="text-xs font-medium text-[color:var(--ui-text-secondary)]">Son 24 saatte toplam olay</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[color:var(--ui-text-primary)]">{last24hTotal}</p>
          <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">Filtrelenen kayıtlar içinde</p>
        </article>
        <article className={cardClasses({ tone: "danger", className: "p-3.5 shadow-none" })}>
          <p className="text-xs font-medium text-[color:var(--ui-danger)]">Engellenen olay</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[color:var(--ui-text-primary)]">{blockedTotal}</p>
          <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">Engelleme kararları</p>
        </article>
        <article className={cardClasses({ tone: "warning", className: "p-3.5 shadow-none" })}>
          <p className="text-xs font-medium text-[color:var(--ui-warning)]">İnceleme gerektiren</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[color:var(--ui-text-primary)]">{reviewTotal}</p>
          <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">İnceleme kararı</p>
        </article>
        <article className={cardClasses({ className: "p-3.5 shadow-none" })}>
          <p className="text-xs font-medium text-[color:var(--ui-text-secondary)]">En sık event tipi</p>
          <p className="mt-1 text-sm font-semibold text-[color:var(--ui-text-primary)]">{topEventLabel}</p>
          <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
            {topEventCode ? `${topEventFrequency} kez` : "Veri yok"}
          </p>
        </article>
      </section>

      <section className={SECTION_CARD_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-2.5 border-b border-[color:var(--ui-border)] px-4 py-3.5 sm:px-5">
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Güvenlik Olay Tablosu</h3>
            <p className="mt-0.5 text-xs text-[color:var(--ui-text-secondary)]">
              Olay türü, risk profili, gerekçeler ve verilen kararları aynı görünümde izleyin.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] px-2.5 py-1 text-xs font-medium text-[color:var(--ui-text-secondary)]">
            {events.length} kayıt
          </span>
        </div>

        {events.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-semibold text-[color:var(--ui-text-primary)]">
              Seçilen filtrelerde güvenlik olayı bulunamadı
            </p>
            <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
              Aralığı genişleterek veya risk seviyesini değiştirerek daha fazla kayıt
              görüntüleyebilirsiniz.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-[color:var(--ui-surface-subtle)]">
                <tr className="border-b border-[color:var(--ui-border)]">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)] sm:px-5">
                    Tarih
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)] sm:px-5">
                    Event / Tür
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)] sm:px-5">
                    Risk
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)] sm:px-5">
                    IP
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)] sm:px-5">
                    Masa
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)] sm:px-5">
                    Gerekçeler
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)] sm:px-5">
                    Aksiyon / Karar
                  </th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => {
                  const typeLabel = getSecurityEventTypeLabel(event.type);
                  const actionLabel = getSecurityActionLabel(event.action);
                  const decisionLabel = getSecurityDecisionLabel(event.decision);
                  const compactDate = formatSecurityDateCompact(event.createdAt);
                  const fullDate = formatSecurityDateFull(event.createdAt);
                  const tableRef = formatSecurityTableRef(event.tableId, event.tableNo);
                  const reasons = event.reasons.map((reason) => getSecurityReasonLabel(reason));

                  return (
                    <tr
                      key={event.id}
                      className="border-b border-[color:var(--ui-border-subtle)] align-top transition-colors hover:bg-[color:var(--ui-surface-subtle)]"
                    >
                      <td className="px-4 py-3 sm:px-5">
                        <p className="font-medium tabular-nums text-[color:var(--ui-text-primary)]">{compactDate}</p>
                        <p className="mt-0.5 text-xs tabular-nums text-[color:var(--ui-text-secondary)]" title={fullDate}>
                          {fullDate}
                        </p>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <p
                          className="max-w-64 truncate font-medium text-[color:var(--ui-text-primary)]"
                          title={event.type ? `${typeLabel} (${event.type})` : typeLabel}
                        >
                          {typeLabel}
                        </p>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${riskBadgeClass(
                            event.riskLevel,
                          )}`}
                        >
                          {getRiskLevelLabel(event.riskLevel)} â€¢ {event.riskScore}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[color:var(--ui-text-secondary)] sm:px-5">
                        <span title={event.ipHash ?? "-"}>{compactIpHash(event.ipHash)}</span>
                      </td>
                      <td className="px-4 py-3 text-[color:var(--ui-text-secondary)] sm:px-5">{tableRef}</td>
                      <td className="px-4 py-3 sm:px-5">
                        {reasons.length === 0 ? (
                          <span className="text-xs text-[color:var(--ui-text-secondary)]">Sorun tespit edilmedi</span>
                        ) : (
                          <p className="max-w-96 whitespace-normal break-words text-xs text-[color:var(--ui-text-secondary)]">
                            {reasons.join(" â€¢ ")}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <div className="space-y-2">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                              Aksiyon
                            </p>
                            <p
                              className="max-w-56 truncate font-medium text-[color:var(--ui-text-primary)]"
                              title={event.action ? `${actionLabel} (${event.action})` : actionLabel}
                            >
                              {actionLabel}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)]">
                              Karar
                            </p>
                            <p
                              className="max-w-56 truncate font-medium text-[color:var(--ui-text-primary)]"
                              title={event.decision ? `${decisionLabel} (${event.decision})` : decisionLabel}
                            >
                              {decisionLabel}
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}


