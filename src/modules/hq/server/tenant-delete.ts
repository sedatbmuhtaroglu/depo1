import type { Prisma } from "@prisma/client";

export type TenantPurgeSummary = {
  tenantId: number;
  detachedLeads: number;
  detachedCommercialRecords: number;
};

export async function purgeTenantOperationalDataTx(
  tx: Prisma.TransactionClient,
  tenantId: number,
): Promise<TenantPurgeSummary> {
  // Restaurant/tree verisi tenant silinmeden once temizlenir; aksi halde Restrict FK bloklar.
  await tx.orderItemOption.deleteMany({
    where: {
      order: {
        table: {
          restaurant: { tenantId },
        },
      },
    },
  });

  await tx.paymentIntent.deleteMany({ where: { tenantId } });
  await tx.payment.deleteMany({ where: { tenantId } });
  await tx.cashOrderAdjustment.deleteMany({ where: { tenantId } });
  await tx.orderItemCancellation.deleteMany({ where: { tenantId } });

  await tx.order.deleteMany({
    where: {
      table: {
        restaurant: { tenantId },
      },
    },
  });

  await tx.waiterCall.deleteMany({ where: { tenantId } });
  await tx.billRequest.deleteMany({ where: { tenantId } });
  await tx.securityEvent.deleteMany({ where: { tenantId } });
  await tx.tableSession.deleteMany({ where: { tenantId } });

  await tx.menuPopularShowcaseItem.deleteMany({
    where: {
      showcase: { tenantId },
    },
  });
  await tx.menuFrequentShowcaseItem.deleteMany({
    where: {
      showcase: { tenantId },
    },
  });
  await tx.menuPopularShowcase.deleteMany({ where: { tenantId } });
  await tx.menuFrequentShowcase.deleteMany({ where: { tenantId } });

  await tx.productOption.deleteMany({
    where: {
      group: {
        product: {
          category: {
            restaurant: { tenantId },
          },
        },
      },
    },
  });

  await tx.productOptionGroup.deleteMany({
    where: {
      product: {
        category: {
          restaurant: { tenantId },
        },
      },
    },
  });

  await tx.product.deleteMany({
    where: {
      category: {
        restaurant: { tenantId },
      },
    },
  });

  await tx.category.deleteMany({
    where: {
      restaurant: { tenantId },
    },
  });

  await tx.menu.deleteMany({ where: { tenantId } });
  await tx.restaurantWorkingHour.deleteMany({
    where: {
      restaurant: { tenantId },
    },
  });
  await tx.table.deleteMany({
    where: {
      restaurant: { tenantId },
    },
  });
  await tx.restaurant.deleteMany({ where: { tenantId } });

  const detachedCommercial = await tx.commercialRecord.updateMany({
    where: { tenantId },
    data: { tenantId: null },
  });
  const detachedLeads = await tx.salesLead.updateMany({
    where: { tenantId },
    data: { tenantId: null },
  });

  await tx.tenant.delete({
    where: { id: tenantId },
  });

  return {
    tenantId,
    detachedLeads: detachedLeads.count,
    detachedCommercialRecords: detachedCommercial.count,
  };
}
