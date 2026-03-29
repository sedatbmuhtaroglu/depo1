﻿import {
  FeatureCode,
  PaymentMethod,
  PlanCode,
  PrismaClient,
  StaffRole,
  Weekday,
} from "@prisma/client";
import { hashPassword } from "../src/lib/password";
import { isLegacyPlaintextSecret } from "../src/lib/secret-crypto";

const prisma = new PrismaClient();

const DEMO = {
  tenantName: "?atal App Demo Tenant",
  tenantSlug: "menucy-demo",
  tenantDomain: "menucy-demo.local",
  restaurantName: "?atal App Demo Restaurant",
  restaurantSlug: "menucy-demo-restaurant",
  menuName: "Ana MenÃ¼",
};

const TABLE_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8];

const CATEGORY_DEFS = [
  {
    nameTR: "Ana Yemek",
    nameEN: "Main",
    products: [
      {
        nameTR: "Izgara KÃ¶fte",
        nameEN: "Grilled Meatballs",
        price: 320,
        descriptionTR: "Porsiyon Ä±zgara kÃ¶fte",
        tags: ["yemek"],
        trackStock: true,
        stockQuantity: 24,
      },
      {
        nameTR: "Kasap Burger",
        nameEN: "Butcher Burger",
        price: 290,
        descriptionTR: "El yapÄ±mÄ± burger",
        tags: ["yemek"],
        trackStock: true,
        stockQuantity: 15,
      },
    ],
  },
  {
    nameTR: "Ä°Ã§ecek",
    nameEN: "Beverage",
    products: [
      {
        nameTR: "Ayran",
        nameEN: "Ayran",
        price: 40,
        descriptionTR: "200 ml",
        tags: ["icecek"],
        trackStock: true,
        stockQuantity: 40,
      },
      {
        nameTR: "Kola",
        nameEN: "Cola",
        price: 55,
        descriptionTR: "330 ml kutu",
        tags: ["icecek"],
        trackStock: false,
        stockQuantity: 0,
      },
      {
        nameTR: "Limonata",
        nameEN: "Lemonade",
        price: 65,
        descriptionTR: "Ev yapÄ±mÄ±",
        tags: ["icecek"],
        trackStock: true,
        stockQuantity: 0,
      },
    ],
  },
  {
    nameTR: "TatlÄ±",
    nameEN: "Dessert",
    products: [
      {
        nameTR: "SÃ¼tlaÃ§",
        nameEN: "Rice Pudding",
        price: 95,
        descriptionTR: "FÄ±rÄ±nda sÃ¼tlaÃ§",
        tags: ["tatli"],
        trackStock: true,
        stockQuantity: 18,
      },
    ],
  },
];

type CleanupSummary = {
  orders: number;
  payments: number;
  cancellations: number;
  cashAdjustments: number;
  billRequests: number;
  waiterCalls: number;
  tableSessions: number;
  paymentIntents: number;
  auditLogs: number;
  securityEvents: number;
};

async function ensurePlanAndFeatures() {
  const [miniPlan, restaurantPlan, corporatePlan] = await Promise.all([
    prisma.plan.upsert({
      where: { code: PlanCode.MINI },
      update: { name: "Mini", isActive: true },
      create: { name: "Mini", code: PlanCode.MINI, priceMonthly: null, isActive: true },
    }),
    prisma.plan.upsert({
      where: { code: PlanCode.RESTAURANT },
      update: { name: "Restaurant", isActive: true },
      create: {
        name: "Restaurant",
        code: PlanCode.RESTAURANT,
        priceMonthly: null,
        isActive: true,
      },
    }),
    prisma.plan.upsert({
      where: { code: PlanCode.CORPORATE },
      update: { name: "Corporate", isActive: true },
      create: {
        name: "Corporate",
        code: PlanCode.CORPORATE,
        priceMonthly: null,
        isActive: true,
      },
    }),
  ]);

  const featureDefs: Array<{ code: FeatureCode; name: string; description: string }> = [
    { code: FeatureCode.MENU, name: "Menu", description: "Digital menu" },
    { code: FeatureCode.WAITER_CALL, name: "Waiter Call", description: "Customer waiter call" },
    { code: FeatureCode.ORDERING, name: "Ordering", description: "Customer ordering" },
    { code: FeatureCode.INVOICING, name: "Invoicing", description: "Billing and invoicing" },
    {
      code: FeatureCode.ADVANCED_REPORTS,
      name: "Advanced Reports",
      description: "Extended reports and insights",
    },
    {
      code: FeatureCode.KITCHEN_DISPLAY,
      name: "Kitchen Display",
      description: "Kitchen queue display",
    },
    {
      code: FeatureCode.ANALYTICS,
      name: "Analytics",
      description: "Analytics module",
    },
    {
      code: FeatureCode.CUSTOM_DOMAIN,
      name: "Custom Domain",
      description: "Tenant custom domain",
    },
  ];

  const features = new Map<FeatureCode, number>();
  for (const featureDef of featureDefs) {
    const feature = await prisma.feature.upsert({
      where: { code: featureDef.code },
      update: { name: featureDef.name, description: featureDef.description },
      create: {
        code: featureDef.code,
        name: featureDef.name,
        description: featureDef.description,
      },
    });
    features.set(featureDef.code, feature.id);
  }

  const planFeaturePairs: Array<{ planId: number; featureCode: FeatureCode }> = [
    { planId: miniPlan.id, featureCode: FeatureCode.MENU },
    { planId: miniPlan.id, featureCode: FeatureCode.ORDERING },
    { planId: restaurantPlan.id, featureCode: FeatureCode.MENU },
    { planId: restaurantPlan.id, featureCode: FeatureCode.ORDERING },
    { planId: restaurantPlan.id, featureCode: FeatureCode.WAITER_CALL },
    { planId: restaurantPlan.id, featureCode: FeatureCode.KITCHEN_DISPLAY },
    { planId: restaurantPlan.id, featureCode: FeatureCode.INVOICING },
    { planId: corporatePlan.id, featureCode: FeatureCode.MENU },
    { planId: corporatePlan.id, featureCode: FeatureCode.WAITER_CALL },
    { planId: corporatePlan.id, featureCode: FeatureCode.ORDERING },
    { planId: corporatePlan.id, featureCode: FeatureCode.KITCHEN_DISPLAY },
    { planId: corporatePlan.id, featureCode: FeatureCode.INVOICING },
    { planId: corporatePlan.id, featureCode: FeatureCode.ADVANCED_REPORTS },
    { planId: corporatePlan.id, featureCode: FeatureCode.ANALYTICS },
    { planId: corporatePlan.id, featureCode: FeatureCode.CUSTOM_DOMAIN },
  ];

  for (const pair of planFeaturePairs) {
    const featureId = features.get(pair.featureCode);
    if (!featureId) continue;
    await prisma.planFeature.upsert({
      where: {
        planId_featureId: {
          planId: pair.planId,
          featureId,
        },
      },
      update: {},
      create: {
        planId: pair.planId,
        featureId,
      },
    });
  }

  return { corporatePlanId: corporatePlan.id };
}

function isCleanDemoModeEnabled() {
  return (process.env.DEMO_SEED_CLEAN ?? "true").toLowerCase() === "true";
}

function canRunCleanup() {
  if (process.env.NODE_ENV !== "production") return true;
  return (process.env.DEMO_SEED_ALLOW_CLEAN_IN_PROD ?? "false").toLowerCase() === "true";
}

async function cleanupDemoOperationalData(tenantId: number): Promise<CleanupSummary> {
  const restaurantIds = (
    await prisma.restaurant.findMany({
      where: { tenantId },
      select: { id: true },
    })
  ).map((r) => r.id);

  const tableIds =
    restaurantIds.length === 0
      ? []
      : (
          await prisma.table.findMany({
            where: { restaurantId: { in: restaurantIds } },
            select: { id: true },
          })
        ).map((table) => table.id);

  const orderIds =
    tableIds.length === 0
      ? []
      : (
          await prisma.order.findMany({
            where: { tableId: { in: tableIds } },
            select: { id: true },
          })
        ).map((order) => order.id);

  const summary: CleanupSummary = {
    orders: 0,
    payments: 0,
    cancellations: 0,
    cashAdjustments: 0,
    billRequests: 0,
    waiterCalls: 0,
    tableSessions: 0,
    paymentIntents: 0,
    auditLogs: 0,
    securityEvents: 0,
  };

  await prisma.$transaction(async (tx) => {
    if (orderIds.length > 0) {
      const deletedOrderItemOptions = await tx.orderItemOption.deleteMany({
        where: { orderId: { in: orderIds } },
      });
      if (deletedOrderItemOptions.count > 0) {
        // no-op: order item option count intentionally not in summary output
      }
    }

    summary.cashAdjustments = (
      await tx.cashOrderAdjustment.deleteMany({
        where: { tenantId },
      })
    ).count;

    summary.cancellations = (
      await tx.orderItemCancellation.deleteMany({
        where: { tenantId },
      })
    ).count;

    summary.paymentIntents = (
      await tx.paymentIntent.deleteMany({
        where: { tenantId },
      })
    ).count;

    summary.payments = (
      await tx.payment.deleteMany({
        where: { tenantId },
      })
    ).count;

    summary.billRequests = (
      await tx.billRequest.deleteMany({
        where: { tenantId },
      })
    ).count;

    summary.waiterCalls = (
      await tx.waiterCall.deleteMany({
        where: { tenantId },
      })
    ).count;

    summary.tableSessions = (
      await tx.tableSession.deleteMany({
        where: { tenantId },
      })
    ).count;

    summary.auditLogs = (
      await tx.auditLog.deleteMany({
        where: { tenantId },
      })
    ).count;

    summary.securityEvents = (
      await tx.securityEvent.deleteMany({
        where: { tenantId },
      })
    ).count;

    if (orderIds.length > 0) {
      summary.orders = (
        await tx.order.deleteMany({
          where: { id: { in: orderIds } },
        })
      ).count;
    }
  });

  return summary;
}

async function main() {
  console.log("[seed] demo seed started");
  const { corporatePlanId } = await ensurePlanAndFeatures();

  const tenant = await prisma.tenant.upsert({
    where: { slug: DEMO.tenantSlug },
    update: {
      name: DEMO.tenantName,
      planId: corporatePlanId,
      setupCompleted: true,
    },
    create: {
      name: DEMO.tenantName,
      slug: DEMO.tenantSlug,
      planId: corporatePlanId,
      setupCompleted: true,
    },
  });

  await prisma.setupProgress.upsert({
    where: { tenantId: tenant.id },
    update: {
      currentStep: "completed",
      businessInfoCompleted: true,
      branchSetupCompleted: true,
      tablesSetupCompleted: true,
      menuSetupCompleted: true,
      domainSetupCompleted: true,
      completedAt: new Date(),
    },
    create: {
      tenantId: tenant.id,
      currentStep: "completed",
      businessInfoCompleted: true,
      branchSetupCompleted: true,
      tablesSetupCompleted: true,
      menuSetupCompleted: true,
      domainSetupCompleted: true,
      completedAt: new Date(),
    },
  });

  await prisma.tenantDomain.upsert({
    where: {
      tenantId_domain: {
        tenantId: tenant.id,
        domain: DEMO.tenantDomain,
      },
    },
    update: { isPrimary: true, isVerified: false, type: "SUBDOMAIN" },
    create: {
      tenantId: tenant.id,
      domain: DEMO.tenantDomain,
      isPrimary: true,
      isVerified: false,
      type: "SUBDOMAIN",
    },
  });

  await prisma.tenantPaymentMethod.upsert({
    where: { tenantId_method: { tenantId: tenant.id, method: PaymentMethod.CASH } },
    update: { isActive: true },
    create: { tenantId: tenant.id, method: PaymentMethod.CASH, isActive: true },
  });
  await prisma.tenantPaymentMethod.upsert({
    where: { tenantId_method: { tenantId: tenant.id, method: PaymentMethod.CREDIT_CARD } },
    update: { isActive: true },
    create: { tenantId: tenant.id, method: PaymentMethod.CREDIT_CARD, isActive: true },
  });

  const restaurant = await prisma.restaurant.upsert({
    where: { slug: DEMO.restaurantSlug },
    update: {
      tenantId: tenant.id,
      name: DEMO.restaurantName,
      themeColor: "primary",
      language: "TR",
      openingHour: "09:00",
      closingHour: "23:30",
      locationEnforcementEnabled: false,
      orderRadiusMeters: 150,
      kitchenWarningYellowMin: 5,
      kitchenWarningOrangeMin: 10,
      kitchenWarningRedMin: 15,
      orderingDisabled: false,
    },
    create: {
      tenantId: tenant.id,
      name: DEMO.restaurantName,
      slug: DEMO.restaurantSlug,
      themeColor: "primary",
      language: "TR",
      openingHour: "09:00",
      closingHour: "23:30",
      locationEnforcementEnabled: false,
      orderRadiusMeters: 150,
      kitchenWarningYellowMin: 5,
      kitchenWarningOrangeMin: 10,
      kitchenWarningRedMin: 15,
      orderingDisabled: false,
    },
  });

  const weekdays = [
    Weekday.MONDAY,
    Weekday.TUESDAY,
    Weekday.WEDNESDAY,
    Weekday.THURSDAY,
    Weekday.FRIDAY,
    Weekday.SATURDAY,
    Weekday.SUNDAY,
  ];
  for (const weekday of weekdays) {
    await prisma.restaurantWorkingHour.upsert({
      where: { restaurantId_weekday: { restaurantId: restaurant.id, weekday } },
      update: { isOpen: true, openTime: "09:00", closeTime: "23:30" },
      create: {
        restaurantId: restaurant.id,
        weekday,
        isOpen: true,
        openTime: "09:00",
        closeTime: "23:30",
      },
    });
  }

  const menuExisting = await prisma.menu.findFirst({
    where: { tenantId: tenant.id, restaurantId: restaurant.id, name: DEMO.menuName },
    orderBy: { id: "asc" },
  });
  const menu =
    menuExisting ??
    (await prisma.menu.create({
      data: {
        tenantId: tenant.id,
        restaurantId: restaurant.id,
        name: DEMO.menuName,
        isActive: true,
      },
    }));
  if (!menu.isActive) {
    await prisma.menu.update({
      where: { id: menu.id },
      data: { isActive: true },
    });
  }

  const defaultPasswordHash = await hashPassword("12345678");
  const demoUsers: Array<{
    username: string;
    role: StaffRole;
    displayName: string;
  }> = [
    { username: "demo-manager", role: StaffRole.MANAGER, displayName: "Demo MÃ¼dÃ¼r" },
    { username: "demo-waiter", role: StaffRole.WAITER, displayName: "Demo Garson" },
    { username: "demo-kitchen", role: StaffRole.KITCHEN, displayName: "Demo Mutfak" },
  ];

  await prisma.adminUser.upsert({
    where: { username: "demo-admin" },
    update: { passwordHash: defaultPasswordHash },
    create: { username: "demo-admin", passwordHash: defaultPasswordHash },
  });

  await prisma.adminUser.deleteMany({
    where: {
      username: {
        in: demoUsers.map((user) => user.username),
      },
    },
  });

  for (const user of demoUsers) {

    await prisma.tenantStaff.upsert({
      where: {
        tenantId_username: {
          tenantId: tenant.id,
          username: user.username,
        },
      },
      update: {
        role: user.role,
        displayName: user.displayName,
        passwordHash: defaultPasswordHash,
        mustSetPassword: false,
        isActive: true,
      },
      create: {
        tenantId: tenant.id,
        username: user.username,
        passwordHash: defaultPasswordHash,
        mustSetPassword: false,
        isActive: true,
        role: user.role,
        displayName: user.displayName,
      },
    });
  }

  const tables = [];
  for (const tableNo of TABLE_NUMBERS) {
    const existing = await prisma.table.findFirst({
      where: { restaurantId: restaurant.id, tableNo },
      orderBy: { id: "asc" },
    });
    const publicCode = existing?.publicCode ?? `demo-menucy-t${tableNo}`;
    const qrCode = `qr-${tableNo}`;

    const table =
      existing == null
        ? await prisma.table.create({
            data: {
              restaurantId: restaurant.id,
              tableNo,
              qrCode,
              publicCode,
              isActive: true,
            },
          })
        : await prisma.table.update({
            where: { id: existing.id },
            data: {
              qrCode,
              isActive: true,
            },
          });
    tables.push(table);
  }

  let categoryCount = 0;
  let productCount = 0;
  for (const categoryDef of CATEGORY_DEFS) {
    const categoryExisting = await prisma.category.findFirst({
      where: {
        restaurantId: restaurant.id,
        nameTR: categoryDef.nameTR,
      },
      orderBy: { id: "asc" },
    });
    const category =
      categoryExisting ??
      (await prisma.category.create({
        data: {
          restaurantId: restaurant.id,
          menuId: menu.id,
          nameTR: categoryDef.nameTR,
          nameEN: categoryDef.nameEN,
        },
      }));

    categoryCount += 1;
    if (category.menuId !== menu.id || category.nameEN !== categoryDef.nameEN) {
      await prisma.category.update({
        where: { id: category.id },
        data: { menuId: menu.id, nameEN: categoryDef.nameEN },
      });
    }

    for (const productDef of categoryDef.products) {
      const existingProduct = await prisma.product.findFirst({
        where: {
          categoryId: category.id,
          nameTR: productDef.nameTR,
        },
        orderBy: { id: "asc" },
      });
      if (existingProduct == null) {
        await prisma.product.create({
          data: {
            categoryId: category.id,
            nameTR: productDef.nameTR,
            nameEN: productDef.nameEN,
            descriptionTR: productDef.descriptionTR,
            price: productDef.price,
            isAvailable: true,
            tags: productDef.tags,
            trackStock: productDef.trackStock,
            stockQuantity: productDef.stockQuantity,
          },
        });
      } else {
        await prisma.product.update({
          where: { id: existingProduct.id },
          data: {
            nameEN: productDef.nameEN,
            descriptionTR: productDef.descriptionTR,
            price: productDef.price,
            isAvailable: true,
            tags: productDef.tags,
            trackStock: productDef.trackStock,
            stockQuantity: productDef.stockQuantity,
          },
        });
      }
      productCount += 1;
    }
  }

  let cleanupSummary: CleanupSummary | null = null;
  if (isCleanDemoModeEnabled()) {
    if (canRunCleanup()) {
      cleanupSummary = await cleanupDemoOperationalData(tenant.id);
    } else {
      console.warn(
        "[seed] clean demo mode requested but skipped in production. Set DEMO_SEED_ALLOW_CLEAN_IN_PROD=true to allow.",
      );
    }
  }

  const [orderCount, paymentCount, cancellationCount, refundLikeCount] = await Promise.all([
    prisma.order.count({
      where: {
        table: {
          restaurant: {
            tenantId: tenant.id,
          },
        },
      },
    }),
    prisma.payment.count({ where: { tenantId: tenant.id } }),
    prisma.orderItemCancellation.count({ where: { tenantId: tenant.id } }),
    prisma.order.count({
      where: {
        table: { restaurant: { tenantId: tenant.id } },
        refundStatus: { in: ["REFUND_PENDING", "REFUNDED"] },
      },
    }),
  ]);
  const demoPaymentConfigs = await prisma.tenantPaymentConfig.findMany({
    where: { tenantId: tenant.id },
    select: { secretKey: true },
  });
  const legacyDemoSecretCount = demoPaymentConfigs.filter((config) =>
    isLegacyPlaintextSecret(config.secretKey),
  ).length;
  if (legacyDemoSecretCount > 0) {
    console.warn(
      `[seed] warning: ${legacyDemoSecretCount} demo payment secret record(s) plaintext durumda. secrets backfill scriptini calistirin.`,
    );
  }

  console.log(`[seed] tenant oluÅŸturuldu/gÃ¼ncellendi: ${tenant.slug} (#${tenant.id})`);
  console.log(
    `[seed] restaurant oluÅŸturuldu/gÃ¼ncellendi: ${restaurant.slug} (#${restaurant.id})`,
  );
  console.log(`[seed] masa sayÄ±sÄ±: ${tables.length}`);
  console.log(`[seed] kategori sayÄ±sÄ±: ${categoryCount}`);
  console.log(`[seed] Ã¼rÃ¼n sayÄ±sÄ±: ${productCount}`);
  console.log(`[seed] order count = ${orderCount}`);
  console.log(`[seed] payment count = ${paymentCount}`);
  console.log(`[seed] cancellation/refund count = ${cancellationCount + refundLikeCount}`);
  console.log("[seed] demo kullanÄ±cÄ±larÄ±:");
  console.log("  demo-admin / 12345678");
  console.log("  demo-manager / 12345678");
  console.log("  demo-waiter / 12345678");
  console.log("  demo-kitchen / 12345678");

  if (cleanupSummary) {
    console.log(
      `[seed] clean demo state: orders=${cleanupSummary.orders}, payments=${cleanupSummary.payments}, cancellations=${cleanupSummary.cancellations}, billRequests=${cleanupSummary.billRequests}, waiterCalls=${cleanupSummary.waiterCalls}`,
    );
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("[seed] failed", error);
    await prisma.$disconnect();
    process.exit(1);
  });

