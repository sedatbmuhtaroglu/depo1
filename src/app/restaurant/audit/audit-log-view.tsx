"use client";

import React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { badgeClasses, buttonClasses, cardClasses, fieldClasses } from "@/lib/ui/button-variants";
import {
  formatAuditActionLabel,
  formatAuditDescription,
  formatAuditTargetLabel,
} from "@/lib/restaurant-audit-formatter";

type LogRow = {
  id: number;
  actorType: string;
  actorId?: string;
  role?: string;
  /** Sunucuda çözümlenmiş, ekranda gösterilecek isim (ham id değil). */
  actorDisplayName: string;
  actionType: string;
  entityType: string;
  entityId?: string;
  description?: string;
  createdAt: string;
};

const SECTION_CARD_CLASS = cardClasses({ className: "shadow-none" });

const FILTER_FIELD_CLASS = fieldClasses({
  size: "md",
  className: "h-10 rounded-xl px-3 text-sm",
});

function actionToneVariant(code: string) {
  const normalized = code.toLowerCase();
  if (normalized.includes("delete") || normalized.includes("reject")) {
    return "danger";
  }
  if (normalized.includes("create") || normalized.includes("open") || normalized.includes("settled")) {
    return "success";
  }
  if (
    normalized.includes("update") ||
    normalized.includes("status") ||
    normalized.includes("delivered") ||
    normalized.includes("entered") ||
    normalized.includes("started")
  ) {
    return "info";
  }
  if (
    normalized.includes("expired") ||
    normalized.includes("revoked") ||
    normalized.includes("exited")
  ) {
    return "warning";
  }
  return "neutral";
}

function roleLabel(role?: string) {
  if (!role) return null;
  if (role === "MANAGER") return "Müdür";
  if (role === "CASHIER") return "Kasiyer";
  if (role === "WAITER") return "Garson";
  if (role === "KITCHEN") return "Mutfak";
  return role;
}

function actorKindLabel(actorType?: string) {
  if (actorType === "staff") return "Personel";
  if (actorType === "admin") return "Panel";
  return actorType ?? "";
}

function roleBadgeVariant(role?: string) {
  if (role === "MANAGER") return "info";
  if (role === "CASHIER") return "success";
  if (role === "WAITER") return "neutral";
  if (role === "KITCHEN") return "warning";
  return "neutral";
}

function formatDateParts(isoDate: string) {
  const date = new Date(isoDate);
  return {
    day: date.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

export default function AuditLogView({
  logs,
  actionTypes,
  defaultFrom,
  defaultTo,
  defaultAction,
}: {
  logs: LogRow[];
  actionTypes: string[];
  defaultFrom: string;
  defaultTo: string;
  defaultAction: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleFilter = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const from = (form.querySelector('[name="from"]') as HTMLInputElement)?.value;
    const to = (form.querySelector('[name="to"]') as HTMLInputElement)?.value;
    const action = (form.querySelector('[name="action"]') as HTMLSelectElement)?.value;
    const params = new URLSearchParams(searchParams.toString());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (action) params.set("action", action);
    else params.delete("action");
    router.push(`/restaurant/audit?${params.toString()}`);
  };

  const totalLogs = logs.length;
  const uniqueActionCount = new Set(logs.map((log) => log.actionType)).size;
  const uniqueActorCount = new Set(
    logs.map((log) =>
      log.actorId ? `${log.actorType}:${log.actorId}` : (log.actorType ?? "").trim(),
    ).filter((v) => v.length > 0),
  ).size;

  return (
    <div className="space-y-5">
      <section className={`${SECTION_CARD_CLASS} p-4 sm:p-5`}>
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Filtre ve Kontrol Merkezi</h3>
            <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
              Tarih ve işlem tipi filtresiyle denetim kayıtlarını yönetim perspektifinde inceleyin.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] px-2.5 py-1 text-xs font-medium text-[color:var(--ui-text-secondary)]">
            Seçili aralık: {defaultFrom} - {defaultTo}
          </span>
        </div>

        <form onSubmit={handleFilter} className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">Başlangıç</label>
            <input type="date" name="from" defaultValue={defaultFrom} className={FILTER_FIELD_CLASS} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">Bitiş</label>
            <input type="date" name="to" defaultValue={defaultTo} className={FILTER_FIELD_CLASS} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[color:var(--ui-text-secondary)]">İşlem tipi</label>
            <select name="action" defaultValue={defaultAction} className={FILTER_FIELD_CLASS}>
              <option value="">Tümü</option>
              {actionTypes.map((a) => (
                <option key={a} value={a}>
                  {formatAuditActionLabel(a)}
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
                className: "h-10 rounded-xl",
              })}
            >
              Uygula
            </button>
          </div>
        </form>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className={cardClasses({ className: "p-3.5 shadow-none" })}>
          <p className="text-xs font-medium text-[color:var(--ui-text-secondary)]">Toplam kayıt</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[color:var(--ui-text-primary)]">{totalLogs}</p>
        </article>
        <article className={cardClasses({ tone: "subtle", className: "p-3.5 shadow-none" })}>
          <p className="text-xs font-medium text-[color:var(--ui-info)]">Seçili aralık</p>
          <p className="mt-1 text-sm font-semibold text-[color:var(--ui-text-primary)]">
            {defaultFrom} - {defaultTo}
          </p>
        </article>
        <article className={cardClasses({ className: "p-3.5 shadow-none" })}>
          <p className="text-xs font-medium text-[color:var(--ui-text-secondary)]">Farklı işlem tipi</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[color:var(--ui-text-primary)]">{uniqueActionCount}</p>
        </article>
        <article className={cardClasses({ className: "p-3.5 shadow-none" })}>
          <p className="text-xs font-medium text-[color:var(--ui-text-secondary)]">İşlem yapan kişi</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-[color:var(--ui-text-primary)]">{uniqueActorCount}</p>
        </article>
      </section>

      <section className={SECTION_CARD_CLASS}>
        <div className="flex flex-wrap items-start justify-between gap-2.5 border-b border-[color:var(--ui-border)] px-4 py-3.5 sm:px-5">
          <div>
            <h3 className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Denetim Kayıt Tablosu</h3>
            <p className="mt-0.5 text-xs text-[color:var(--ui-text-secondary)]">
              Zaman, işlem yapan, işlem tipi, hedef ve açıklama bilgileriyle detaylı audit görünümü.
            </p>
          </div>
          <span className="inline-flex items-center rounded-full border border-[color:var(--ui-border)] bg-[color:var(--ui-surface-subtle)] px-2.5 py-1 text-xs font-medium text-[color:var(--ui-text-secondary)]">
            {logs.length} kayıt
          </span>
        </div>

        {logs.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-semibold text-[color:var(--ui-text-primary)]">Bu aralıkta kayıt yok</p>
            <p className="mt-1 text-xs text-[color:var(--ui-text-secondary)]">
              Filtreyi genişletin veya farklı bir işlem tipi seçin.
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
                    Kim
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)] sm:px-5">
                    İşlem
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)] sm:px-5">
                    Hedef
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[color:var(--ui-text-secondary)] sm:px-5">
                    Açıklama
                  </th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => {
                  const createdAt = formatDateParts(l.createdAt);
                  const targetLabel = formatAuditTargetLabel(l.entityType, l.entityId);
                  const readableAction = formatAuditActionLabel(l.actionType);
                  const readableDescription = formatAuditDescription({
                    actionType: l.actionType,
                    entityType: l.entityType,
                    entityId: l.entityId,
                    description: l.description,
                  });
                  const actorLabel = l.actorDisplayName?.trim() || "Bilinmeyen kullanıcı";
                  const actorRole = roleLabel(l.role);
                  const actorKind = actorKindLabel(l.actorType);

                  return (
                    <tr
                      key={l.id}
                      className="border-b border-[color:var(--ui-border-subtle)] align-top transition-colors hover:bg-[color:var(--ui-surface-subtle)]"
                    >
                      <td className="px-4 py-3 sm:px-5">
                        <p className="font-medium tabular-nums">{createdAt.day}</p>
                        <p className="mt-0.5 text-xs tabular-nums text-[color:var(--ui-text-secondary)]">
                          {createdAt.time}
                        </p>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <p className="max-w-64 truncate font-medium" title={actorLabel}>
                          {actorLabel}
                        </p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[color:var(--ui-text-secondary)]">
                          <span className="max-w-48 truncate" title={actorKind}>
                            {actorKind}
                          </span>
                          {actorRole ? (
                            <span className={badgeClasses(roleBadgeVariant(l.role))}>
                              {actorRole}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <span
                          className={`max-w-64 truncate ${badgeClasses(actionToneVariant(l.actionType))}`}
                          title={`${readableAction} (${l.actionType})`}
                        >
                          {readableAction}
                        </span>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <p className="max-w-72 truncate font-medium" title={targetLabel}>
                          {targetLabel}
                        </p>
                      </td>
                      <td className="px-4 py-3 sm:px-5">
                        <p className="max-w-md whitespace-pre-wrap break-words text-sm leading-5 text-[color:var(--ui-text-secondary)]">
                          {readableDescription}
                        </p>
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


