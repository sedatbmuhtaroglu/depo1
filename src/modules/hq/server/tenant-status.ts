import type { TenantLifecycleStatus } from "@/core/tenancy/lifecycle-policy";

export type PersistedTenantStatus = "ACTIVE" | "SUSPENDED" | "EXPIRED";
export type InitialProvisioningStatus = "TRIAL" | "ACTIVE" | "PENDING_SETUP";
export type LifecycleTransitionTarget =
  | "TRIAL"
  | "ACTIVE"
  | "PENDING_SETUP"
  | "SUSPENDED"
  | "PAST_DUE";

export function mapPersistedStatusToLifecycle(
  status: PersistedTenantStatus,
): TenantLifecycleStatus {
  if (status === "SUSPENDED") return "SUSPENDED";
  if (status === "EXPIRED") return "PAST_DUE";
  return "ACTIVE";
}

export function getLifecycleLabel(status: TenantLifecycleStatus): string {
  switch (status) {
    case "DRAFT":
      return "Taslak";
    case "PENDING_SETUP":
      return "Kurulum Bekliyor";
    case "TRIAL":
      return "Deneme";
    case "ACTIVE":
      return "Aktif";
    case "PAST_DUE":
      return "Odeme Gecikmis";
    case "SUSPENDED":
      return "Askida";
    case "CANCELED":
      return "Iptal";
    default:
      return status;
  }
}

export function getLifecycleBadgeVariant(
  status: TenantLifecycleStatus,
): "neutral" | "info" | "success" | "warning" | "danger" {
  if (status === "ACTIVE") return "success";
  if (status === "TRIAL" || status === "PENDING_SETUP") return "info";
  if (status === "PAST_DUE") return "warning";
  if (status === "SUSPENDED" || status === "CANCELED") return "danger";
  return "neutral";
}

export function resolveProvisioningStatus(input: InitialProvisioningStatus): {
  status: PersistedTenantStatus;
  setupCompleted: boolean;
  setupStep: string;
} {
  if (input === "ACTIVE") {
    return {
      status: "ACTIVE",
      setupCompleted: true,
      setupStep: "COMPLETED",
    };
  }
  if (input === "TRIAL") {
    return {
      status: "ACTIVE",
      setupCompleted: false,
      setupStep: "TRIAL",
    };
  }
  return {
    status: "ACTIVE",
    setupCompleted: false,
    setupStep: "PENDING_SETUP",
  };
}

function getAllowedTargets(status: TenantLifecycleStatus): PersistedTenantStatus[] {
  if (status === "SUSPENDED") {
    return ["ACTIVE"];
  }
  if (status === "PAST_DUE") {
    return ["ACTIVE", "SUSPENDED"];
  }
  if (status === "ACTIVE" || status === "TRIAL" || status === "PENDING_SETUP") {
    return ["SUSPENDED", "EXPIRED"];
  }
  if (status === "DRAFT" || status === "CANCELED") {
    return ["ACTIVE", "SUSPENDED"];
  }
  return [];
}

export function isTenantStatusTransitionAllowed(input: {
  currentLifecycleStatus: TenantLifecycleStatus;
  targetStatus: PersistedTenantStatus;
}): boolean {
  const allowedTargets = getAllowedTargets(input.currentLifecycleStatus);
  return allowedTargets.includes(input.targetStatus);
}

function getAllowedLifecycleTargets(status: TenantLifecycleStatus): LifecycleTransitionTarget[] {
  if (status === "TRIAL") {
    return ["ACTIVE", "SUSPENDED", "PAST_DUE"];
  }
  if (status === "PENDING_SETUP") {
    return ["TRIAL", "ACTIVE", "SUSPENDED"];
  }
  if (status === "ACTIVE") {
    return ["TRIAL", "PENDING_SETUP", "SUSPENDED", "PAST_DUE"];
  }
  if (status === "PAST_DUE") {
    return ["ACTIVE", "SUSPENDED", "TRIAL"];
  }
  if (status === "SUSPENDED") {
    return ["ACTIVE", "TRIAL", "PENDING_SETUP"];
  }
  if (status === "DRAFT" || status === "CANCELED") {
    return ["ACTIVE", "TRIAL", "PENDING_SETUP", "SUSPENDED"];
  }
  return [];
}

export function isTenantLifecycleTransitionAllowed(input: {
  currentLifecycleStatus: TenantLifecycleStatus;
  targetLifecycleStatus: LifecycleTransitionTarget;
}): boolean {
  return getAllowedLifecycleTargets(input.currentLifecycleStatus).includes(
    input.targetLifecycleStatus,
  );
}

export function resolveLifecycleTransitionPatch(target: LifecycleTransitionTarget): {
  status: PersistedTenantStatus;
  setupCompleted: boolean;
  setupStep: string;
} {
  if (target === "ACTIVE") {
    return { status: "ACTIVE", setupCompleted: true, setupStep: "COMPLETED" };
  }
  if (target === "TRIAL") {
    return { status: "ACTIVE", setupCompleted: false, setupStep: "TRIAL" };
  }
  if (target === "PENDING_SETUP") {
    return { status: "ACTIVE", setupCompleted: false, setupStep: "PENDING_SETUP" };
  }
  if (target === "SUSPENDED") {
    return { status: "SUSPENDED", setupCompleted: false, setupStep: "SUSPENDED" };
  }
  return { status: "EXPIRED", setupCompleted: false, setupStep: "PAST_DUE" };
}
