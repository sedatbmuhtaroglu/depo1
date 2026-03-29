import type { SalesLeadSource, SalesLeadStatus } from "@prisma/client";

export const SALES_LEAD_STATUSES: SalesLeadStatus[] = [
  "NEW",
  "CONTACTED",
  "DEMO_SCHEDULED",
  "TRIAL_STARTED",
  "WON",
  "LOST",
];

export const SALES_LEAD_SOURCES: SalesLeadSource[] = [
  "INSTAGRAM",
  "WEBSITE",
  "REFERRAL",
  "MANUAL",
  "DEMO",
  "OTHER",
];

export function parseSalesLeadStatus(value: string | null | undefined): SalesLeadStatus | null {
  const raw = (value ?? "").trim().toUpperCase();
  return SALES_LEAD_STATUSES.find((status) => status === raw) ?? null;
}

export function parseSalesLeadSource(value: string | null | undefined): SalesLeadSource | null {
  const raw = (value ?? "").trim().toUpperCase();
  return SALES_LEAD_SOURCES.find((source) => source === raw) ?? null;
}

export function getSalesLeadStatusLabel(status: SalesLeadStatus): string {
  if (status === "NEW") return "Yeni";
  if (status === "CONTACTED") return "Iletisime Gecildi";
  if (status === "DEMO_SCHEDULED") return "Demo Planlandi";
  if (status === "TRIAL_STARTED") return "Trial Basladi";
  if (status === "WON") return "Musteri Kazanildi";
  return "Kaybedildi";
}

export function getSalesLeadSourceLabel(source: SalesLeadSource): string {
  if (source === "INSTAGRAM") return "Instagram";
  if (source === "WEBSITE") return "Website";
  if (source === "REFERRAL") return "Referans";
  if (source === "MANUAL") return "Manuel";
  if (source === "DEMO") return "Demo";
  return "Diger";
}

export function getSalesLeadStatusBadgeVariant(
  status: SalesLeadStatus,
): "neutral" | "info" | "warning" | "success" | "danger" {
  if (status === "NEW") return "info";
  if (status === "CONTACTED" || status === "DEMO_SCHEDULED") return "warning";
  if (status === "TRIAL_STARTED") return "info";
  if (status === "WON") return "success";
  return "danger";
}

const LEAD_STATUS_TRANSITIONS: Record<SalesLeadStatus, readonly SalesLeadStatus[]> = {
  NEW: ["CONTACTED", "DEMO_SCHEDULED", "LOST"],
  CONTACTED: ["DEMO_SCHEDULED", "TRIAL_STARTED", "LOST"],
  DEMO_SCHEDULED: ["CONTACTED", "TRIAL_STARTED", "LOST"],
  TRIAL_STARTED: ["WON", "LOST", "CONTACTED"],
  WON: [],
  LOST: ["CONTACTED"],
};

export function isSalesLeadStatusTransitionAllowed(input: {
  currentStatus: SalesLeadStatus;
  targetStatus: SalesLeadStatus;
}) {
  if (input.currentStatus === input.targetStatus) return true;
  return LEAD_STATUS_TRANSITIONS[input.currentStatus].includes(input.targetStatus);
}

export function getEditableLeadStatuses(currentStatus: SalesLeadStatus): SalesLeadStatus[] {
  const candidates: SalesLeadStatus[] = ["NEW", "CONTACTED", "DEMO_SCHEDULED", "LOST"];
  return candidates.filter((targetStatus) =>
    isSalesLeadStatusTransitionAllowed({
      currentStatus,
      targetStatus,
    }),
  );
}
