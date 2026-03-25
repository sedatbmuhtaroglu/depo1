import { Prisma } from "@prisma/client";
import { hasFeature } from "@/core/entitlements/engine";
import {
  resolveTenantLifecycleSnapshotFromRow,
  type TenantLifecycleStatus,
} from "@/core/tenancy/lifecycle-policy";
import { prisma } from "@/lib/prisma";

type PrismaClientLike = typeof prisma | Prisma.TransactionClient;

export const TENANT_SETUP_STEP_CODES = [
  "tenant_created",
  "domain_ready",
  "first_restaurant_created",
  "menu_seeded_or_created",
  "tables_created",
  "staff_invited_or_created",
  "payment_configured",
  "publishing_ready",
] as const;

export type TenantSetupStepCode = (typeof TENANT_SETUP_STEP_CODES)[number];

export type TenantSetupStep = {
  code: TenantSetupStepCode;
  required: boolean;
  completed: boolean;
  completedAt: Date | null;
  blocker: string | null;
};

export type TenantSetupSnapshot = {
  tenantId: number;
  lifecycleStatus: TenantLifecycleStatus;
  setupStep: string | null;
  setupCompleted: boolean;
  goLiveReady: boolean;
  requiredCompletedCount: number;
  requiredTotalCount: number;
  completionPercent: number;
  blockers: string[];
  steps: TenantSetupStep[];
};

const REQUIRED_BASE_STEPS = new Set<TenantSetupStepCode>([
  "tenant_created",
  "domain_ready",
  "first_restaurant_created",
  "menu_seeded_or_created",
  "tables_created",
  "staff_invited_or_created",
]);

const GO_LIVE_ALLOWED_LIFECYCLE = new Set<TenantLifecycleStatus>(["ACTIVE", "TRIAL"]);

function completedAtOrNull(value: Date | null | undefined) {
  return value ?? null;
}

function computeCompletionPercent(requiredCompleted: number, requiredTotal: number) {
  if (requiredTotal <= 0) return 0;
  return Math.round((requiredCompleted / requiredTotal) * 100);
}

function buildStep(input: {
  code: TenantSetupStepCode;
  required: boolean;
  completed: boolean;
  completedAt?: Date | null;
  blocker?: string | null;
}): TenantSetupStep {
  return {
    code: input.code,
    required: input.required,
    completed: input.completed,
    completedAt: completedAtOrNull(input.completedAt),
    blocker: input.completed ? null : (input.blocker ?? null),
  };
}

export async function resolveTenantSetupProgress(
  tenantId: number,
  client: PrismaClientLike = prisma,
): Promise<TenantSetupSnapshot> {
  const tenant = await client.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      status: true,
      createdAt: true,
      setupCompleted: true,
      setupProgress: {
        select: {
          currentStep: true,
          completedAt: true,
        },
      },
    },
  });

  if (!tenant) {
    throw new Error("TENANT_NOT_FOUND");
  }

  const lifecycle = resolveTenantLifecycleSnapshotFromRow({
    tenantId: tenant.id,
    status: String(tenant.status),
    setupCompleted: tenant.setupCompleted,
    setupStep: tenant.setupProgress?.currentStep ?? null,
  });

  const [
    primaryDomain,
    restaurantCount,
    menuSummary,
    productCount,
    tableCount,
    staffSummary,
    activePaymentConfig,
    activePaymentMethodsCount,
    orderingFeatureEnabled,
  ] = await Promise.all([
    client.tenantDomain.findFirst({
      where: {
        tenantId,
        isPrimary: true,
      },
      select: {
        id: true,
        createdAt: true,
      },
      orderBy: { id: "asc" },
    }),
    client.restaurant.count({
      where: { tenantId },
    }),
    client.menu.aggregate({
      where: { tenantId },
      _count: { _all: true },
      _min: { createdAt: true },
    }),
    client.product.count({
      where: {
        category: {
          restaurant: {
            tenantId,
          },
        },
      },
    }),
    client.table.count({
      where: {
        restaurant: {
          tenantId,
        },
      },
    }),
    client.tenantStaff.aggregate({
      where: { tenantId },
      _count: { _all: true },
      _min: { createdAt: true },
    }),
    client.tenantPaymentConfig.findFirst({
      where: {
        tenantId,
        isActive: true,
      },
      select: {
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    client.tenantPaymentMethod.count({
      where: {
        tenantId,
        isActive: true,
      },
    }),
    hasFeature(tenantId, "ORDERING", client),
  ]);

  const hasDomain = Boolean(primaryDomain);
  const hasRestaurant = restaurantCount > 0;
  const hasMenuOrProduct = menuSummary._count._all > 0 || productCount > 0;
  const hasTables = tableCount > 0;
  const hasStaff = staffSummary._count._all > 0;
  const paymentConfigured = Boolean(activePaymentConfig) || activePaymentMethodsCount > 0;

  const stepsWithoutPublishing: TenantSetupStep[] = [
    buildStep({
      code: "tenant_created",
      required: true,
      completed: true,
      completedAt: tenant.createdAt,
    }),
    buildStep({
      code: "domain_ready",
      required: true,
      completed: hasDomain,
      completedAt: primaryDomain?.createdAt ?? null,
      blocker: "Primary domain veya subdomain tanimi eksik.",
    }),
    buildStep({
      code: "first_restaurant_created",
      required: true,
      completed: hasRestaurant,
      blocker: "En az 1 restoran kaydi gerekli.",
    }),
    buildStep({
      code: "menu_seeded_or_created",
      required: true,
      completed: hasMenuOrProduct,
      completedAt: menuSummary._min.createdAt ?? null,
      blocker: "En az 1 menu veya ?r?n girilmesi gerekli.",
    }),
    buildStep({
      code: "tables_created",
      required: true,
      completed: hasTables,
      blocker: "En az 1 masa olusturulmasi gerekli.",
    }),
    buildStep({
      code: "staff_invited_or_created",
      required: true,
      completed: hasStaff,
      completedAt: staffSummary._min.createdAt ?? null,
      blocker: "En az 1 personel hesabi gerekli.",
    }),
    buildStep({
      code: "payment_configured",
      required: false,
      completed: paymentConfigured,
      completedAt: activePaymentConfig?.createdAt ?? null,
      blocker: "Odeme ayarlari henuz tamamlanmadi.",
    }),
  ];

  const blockers = stepsWithoutPublishing
    .filter((step) => REQUIRED_BASE_STEPS.has(step.code) && !step.completed && step.blocker)
    .map((step) => step.blocker as string);

  if (!GO_LIVE_ALLOWED_LIFECYCLE.has(lifecycle.normalizedStatus)) {
    blockers.push(`Lifecycle durumu canliya uygun degil (${lifecycle.normalizedStatus}).`);
  }

  if (!orderingFeatureEnabled) {
    blockers.push("ORDERING ozelligi tenant icin kapali.");
  }

  const goLiveReady = blockers.length === 0;

  const publishingReadyStep = buildStep({
    code: "publishing_ready",
    required: true,
    completed: goLiveReady,
    completedAt: goLiveReady ? tenant.setupProgress?.completedAt ?? null : null,
    blocker: "Canliya alma kosullari henuz tamam degil.",
  });

  const steps = [...stepsWithoutPublishing, publishingReadyStep];
  const requiredTotalCount = steps.filter((step) => step.required).length;
  const requiredCompletedCount = steps.filter((step) => step.required && step.completed).length;

  return {
    tenantId,
    lifecycleStatus: lifecycle.normalizedStatus,
    setupStep: tenant.setupProgress?.currentStep ?? null,
    setupCompleted: tenant.setupCompleted,
    goLiveReady,
    requiredCompletedCount,
    requiredTotalCount,
    completionPercent: computeCompletionPercent(requiredCompletedCount, requiredTotalCount),
    blockers,
    steps,
  };
}

export function isTenantReadyForGoLive(snapshot: TenantSetupSnapshot): boolean {
  return snapshot.goLiveReady;
}

export class TenantGoLiveReadinessError extends Error {
  readonly code: "TENANT_GO_LIVE_NOT_READY";
  readonly tenantId: number;
  readonly blockers: string[];
  readonly snapshot: TenantSetupSnapshot;

  constructor(snapshot: TenantSetupSnapshot) {
    super("Tenant is not ready for go-live.");
    this.name = "TenantGoLiveReadinessError";
    this.code = "TENANT_GO_LIVE_NOT_READY";
    this.tenantId = snapshot.tenantId;
    this.blockers = snapshot.blockers;
    this.snapshot = snapshot;
  }
}

export async function assertTenantReadyForGoLive(
  tenantId: number,
  client: PrismaClientLike = prisma,
): Promise<TenantSetupSnapshot> {
  const snapshot = await resolveTenantSetupProgress(tenantId, client);
  if (!snapshot.goLiveReady) {
    throw new TenantGoLiveReadinessError(snapshot);
  }
  return snapshot;
}
