'use server'

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma, prismaModelHasField } from "@/lib/prisma";
import { getProductMenuVisibilityWhere } from "@/lib/product-visibility";
import {
  requireValidTableSessionForRequest,
  TableSessionError,
} from "@/lib/table-session";
import {
  TABLE_ACTION_COOLDOWNS,
  assertTableSessionActionAllowed,
  RateLimitError,
} from "@/lib/rate-limit";
import { opLog } from "@/lib/op-logger";
import type { RateLimitInfo } from "@/lib/rate-limit";
import { logServerError } from "@/lib/server-error-log";
import {
  validateOrderLocationForTenant,
  type OrderLocationInput,
} from "@/lib/order-location";
import { ClientRiskSignals } from "@/lib/security/types";
import { hashValue } from "@/lib/security/hash";
import { getRequestSecurityContext } from "@/lib/security/request-context";
import { evaluateAndLogRisk } from "@/lib/security/risk-engine";
import {
  CustomerPaymentMethod,
  getTenantCustomerPaymentMethods,
  isCustomerPaymentMethodEnabled,
  toDbPaymentMethod,
} from "@/lib/payment-methods";
import { initializeIyzicoCheckoutForOrder } from "@/lib/iyzico-order-checkout";
import { evaluateRestaurantOrderingAvailability } from "@/lib/restaurant-working-hours";
import { resolveSafeAppBaseUrl } from "@/lib/security/allowed-origins";
import { DistributedRateLimitError } from "@/lib/security/distributed-rate-limit";
import { assertOrderCheckoutInitRateLimit } from "@/lib/security/payment-rate-limit";
import { hasFeature } from "@/core/entitlements/engine";

type SelectedOptionGroup = {
  groupId: number;
  optionIds: number[];
};

type CartItem = {
  id: number;
  quantity: number;
  price: number;
  selectedOptions?: SelectedOptionGroup[];
};

type NormalizedCartItem = {
  productId: number;
  quantity: number;
  selectedOptions: SelectedOptionGroup[];
};

type ValidatedOrderPayload = {
  items: Array<{
    productId: number;
    quantity: number;
    price: number;
    selectedOptions: SelectedOptionGroup[];
  }>;
  optionRows: Array<{
    productId: number;
    optionId: number;
    quantity: number;
  }>;
  stockAdjustments: Array<{
    productId: number;
    quantity: number;
  }>;
  totalPrice: number;
};

type CreateOrderResult =
  | {
      success: true;
      message: string;
      orderId: number;
      redirectUrl: string;
      paymentStatus: "PENDING" | "INITIATED" | "PAID" | "FAILED" | null;
    }
  | {
      success: false;
      message: string;
      orderId?: number;
      rateLimit?: RateLimitInfo;
    };

const MAX_CART_LINES = 100;
const MAX_ITEM_QUANTITY = 20;

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function appendTenantQuery(path: string, tenantSlug?: string | null): string {
  if (!tenantSlug) return path;
  const delimiter = path.includes("?") ? "&" : "?";
  return `${path}${delimiter}tenant=${encodeURIComponent(tenantSlug)}`;
}

function normalizeCartInput(cart: CartItem[]): NormalizedCartItem[] | null {
  if (!Array.isArray(cart) || cart.length === 0 || cart.length > MAX_CART_LINES) {
    return null;
  }

  const normalized: NormalizedCartItem[] = [];

  for (const rawItem of cart) {
    if (!rawItem || !isPositiveInteger(rawItem.id) || !isPositiveInteger(rawItem.quantity)) {
      return null;
    }
    if (rawItem.quantity > MAX_ITEM_QUANTITY) {
      return null;
    }

    const selectedOptionsMap = new Map<number, Set<number>>();
    if (Array.isArray(rawItem.selectedOptions)) {
      for (const rawGroup of rawItem.selectedOptions) {
        if (!rawGroup || !isPositiveInteger(rawGroup.groupId)) {
          return null;
        }
        const optionSet = selectedOptionsMap.get(rawGroup.groupId) ?? new Set<number>();
        if (Array.isArray(rawGroup.optionIds)) {
          for (const rawOptionId of rawGroup.optionIds) {
            if (!isPositiveInteger(rawOptionId)) {
              return null;
            }
            optionSet.add(rawOptionId);
          }
        }
        selectedOptionsMap.set(rawGroup.groupId, optionSet);
      }
    }

    normalized.push({
      productId: rawItem.id,
      quantity: rawItem.quantity,
      selectedOptions: [...selectedOptionsMap.entries()]
        .map(([groupId, ids]) => ({
          groupId,
          optionIds: [...ids],
        }))
        .filter((group) => group.optionIds.length > 0),
    });
  }

  return normalized;
}

async function buildValidatedOrderPayload(params: {
  tenantId: number;
  restaurantId: number;
  cart: NormalizedCartItem[];
}): Promise<ValidatedOrderPayload> {
  const { tenantId, restaurantId, cart } = params;
  const now = new Date();

  const productIds = [...new Set(cart.map((item) => item.productId))];
  const products = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      isAvailable: true,
      ...getProductMenuVisibilityWhere(now),
      category: {
        restaurantId,
        restaurant: {
          tenantId,
        },
      },
    },
    include: {
      optionGroups: {
        include: {
          options: {
            where: { isActive: true },
            select: { id: true, priceDelta: true },
          },
        },
      },
    },
  });

  if (products.length !== productIds.length) {
    throw new Error("Sepette gecersiz veya pasif urun var.");
  }

  const productMap = new Map(products.map((product) => [product.id, product]));
  const items: ValidatedOrderPayload["items"] = [];
  const optionRows: ValidatedOrderPayload["optionRows"] = [];
  const stockAdjustmentsMap = new Map<number, number>();
  let total = 0;
  const supportsProductStockFields =
    prismaModelHasField("Product", "trackStock") &&
    prismaModelHasField("Product", "stockQuantity");

  for (const line of cart) {
    const product = productMap.get(line.productId);
    if (!product) {
      throw new Error("Sepette gecersiz urun bulundu.");
    }

    const trackStock =
      supportsProductStockFields &&
      ((product as { trackStock?: boolean }).trackStock ?? false);
    const stockQuantityRaw = Number(
      (product as { stockQuantity?: number | null }).stockQuantity ?? 0,
    );
    const stockQuantity = Number.isFinite(stockQuantityRaw)
      ? Math.max(0, Math.floor(stockQuantityRaw))
      : 0;
    if (trackStock && stockQuantity < line.quantity) {
      throw new Error(`"${product.nameTR}" icin yeterli stok yok.`);
    }

    const basePrice = Number(product.price);
    if (!Number.isFinite(basePrice) || basePrice < 0) {
      throw new Error("Urun fiyati gecersiz.");
    }

    const groupMap = new Map(product.optionGroups.map((group) => [group.id, group]));
    const selectedMap = new Map<number, number[]>();

    for (const selectedGroup of line.selectedOptions) {
      const group = groupMap.get(selectedGroup.groupId);
      if (!group) {
        throw new Error("Secilen secenek grubu gecersiz.");
      }

      const uniqueOptionIds = [...new Set(selectedGroup.optionIds)];
      if (group.maxSelect !== null && uniqueOptionIds.length > group.maxSelect) {
        throw new Error("Secilen secenek sayisi izin verilen siniri asiyor.");
      }
      selectedMap.set(group.id, uniqueOptionIds);
    }

    for (const group of product.optionGroups) {
      const selectedCount = selectedMap.get(group.id)?.length ?? 0;
      if (selectedCount < group.minSelect) {
        throw new Error("Zorunlu urun secenekleri eksik.");
      }
      if (group.maxSelect !== null && selectedCount > group.maxSelect) {
        throw new Error("Secilen secenek sayisi gecersiz.");
      }
    }

    let optionExtraPerUnit = 0;
    const normalizedSelections: SelectedOptionGroup[] = [];
    for (const [groupId, optionIds] of selectedMap.entries()) {
      const group = groupMap.get(groupId);
      if (!group) {
        throw new Error("Secenek grubu dogrulanamadi.");
      }
      const optionMap = new Map(group.options.map((option) => [option.id, option]));

      for (const optionId of optionIds) {
        const option = optionMap.get(optionId);
        if (!option) {
          throw new Error("Secilen urun secenegi gecersiz.");
        }
        const delta = option.priceDelta ? Number(option.priceDelta) : 0;
        if (!Number.isFinite(delta)) {
          throw new Error("Secenek fiyati gecersiz.");
        }
        optionExtraPerUnit += delta;
        optionRows.push({
          productId: product.id,
          optionId,
          quantity: line.quantity,
        });
      }

      normalizedSelections.push({
        groupId,
        optionIds,
      });
    }

    const unitPrice = roundCurrency(basePrice + optionExtraPerUnit);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error("Sipariş fiyati gecersiz.");
    }

    total += unitPrice * line.quantity;
    items.push({
      productId: product.id,
      quantity: line.quantity,
      price: unitPrice,
      selectedOptions: normalizedSelections,
    });

    if (trackStock) {
      stockAdjustmentsMap.set(
        product.id,
        (stockAdjustmentsMap.get(product.id) ?? 0) + line.quantity,
      );
    }
  }

  return {
    items,
    optionRows,
    stockAdjustments: [...stockAdjustmentsMap.entries()].map(
      ([productId, quantity]) => ({
        productId,
        quantity,
      }),
    ),
    totalPrice: roundCurrency(total),
  };
}

export async function createOrder(
  cart: CartItem[],
  tableId: string,
  _clientTotal: number,
  customerLocation?: OrderLocationInput | null,
  riskSignals?: ClientRiskSignals | null,
  selectedPaymentMethod?: CustomerPaymentMethod | null,
): Promise<CreateOrderResult> {
  try {
    void _clientTotal;

    const normalizedPaymentMethod = selectedPaymentMethod ?? "PAY_LATER";

    if (
      normalizedPaymentMethod !== "IYZICO" &&
      normalizedPaymentMethod !== "PAY_LATER"
    ) {
      return {
        success: false,
        message: "Gecersiz odeme yontemi secildi.",
      };
    }

    const normalizedCart = normalizeCartInput(cart);
    if (!normalizedCart) {
      return {
        success: false,
        message: "Sepetteki urun bilgileri gecersiz.",
      };
    }

    const {
      tableId: sessionTableId,
      tenantId: sessionTenantId,
      session,
    } = await requireValidTableSessionForRequest({
      tableIdFromRequest: tableId,
    });

    const canOrderViaQr = await hasFeature(sessionTenantId, "QR_ORDERING");
    if (!canOrderViaQr) {
      return {
        success: false,
        message: "Bu ozellige erismek icin lutfen Catal App ile iletisime gecin.",
      };
    }

    const requestCtx = await getRequestSecurityContext();
    const fingerprintHash = hashValue(riskSignals?.fingerprint ?? null);

    await assertTableSessionActionAllowed({
      tenantId: sessionTenantId,
      tableId: sessionTableId,
      action: "CREATE_ORDER",
      config: TABLE_ACTION_COOLDOWNS.CREATE_ORDER,
      fingerprintHash,
      ipOverride: requestCtx.ipRaw,
      sessionScope: session.id,
    });

    const table = await prisma.table.findFirst({
      where: {
        id: sessionTableId,
        isActive: true,
        restaurant: {
          tenantId: sessionTenantId,
        },
      },
      select: {
        id: true,
        tableNo: true,
        restaurantId: true,
        restaurant: {
          select: {
            tenantId: true,
            openingHour: true,
            closingHour: true,
            orderingDisabled: true,
            workingHours: {
              select: {
                weekday: true,
                isOpen: true,
                openTime: true,
                closeTime: true,
              },
            },
            tenant: {
              select: {
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!table) {
      return {
        success: false,
        message: "Bu masa su an aktif degil. Lutfen garsona basvurun.",
      };
    }

    const restaurant = table.restaurant;
    const orderingAvailability = evaluateRestaurantOrderingAvailability({
      orderingDisabled: restaurant.orderingDisabled,
      weeklyHours: restaurant.workingHours,
      openingHour: restaurant.openingHour,
      closingHour: restaurant.closingHour,
    });

    if (!orderingAvailability.isOpen) {
      return {
        success: false,
        message: "Restoran su anda siparişe kapali.",
      };
    }

    const locationValidation = await validateOrderLocationForTenant({
      tenantId: sessionTenantId,
      restaurantId: table.restaurantId,
      customerLocation,
    });

    if (!locationValidation.allowed) {
      return {
        success: false,
        message: locationValidation.message,
      };
    }

    const activePaymentMethods = await getTenantCustomerPaymentMethods(sessionTenantId);
    if (
      !isCustomerPaymentMethodEnabled(normalizedPaymentMethod, activePaymentMethods)
    ) {
      return {
        success: false,
        message: "Secilen odeme yontemi su an aktif degil.",
      };
    }

    const riskResult = await evaluateAndLogRisk({
      tenantId: sessionTenantId,
      tableId: sessionTableId,
      tableSessionId: session.id,
      action: "CREATE_ORDER",
      signals: riskSignals,
    });

    if (riskResult.decision === "block") {
      opLog({
        tenantId: sessionTenantId,
        tableId: sessionTableId,
        action: "CREATE_ORDER_BLOCKED",
        result: "error",
        message: `risk=${riskResult.score}; reasons=${riskResult.reasons.join(",")}`,
      });
      return {
        success: false,
        message:
          "Güvenlik kontrolleri nedeniyle bu sipariş su an alinamiyor. Lutfen bir sure sonra tekrar deneyin.",
      };
    }

    const validatedPayload = await buildValidatedOrderPayload({
      tenantId: sessionTenantId,
      restaurantId: table.restaurantId,
      cart: normalizedCart,
    });

    const supportsOrderPaymentProvider = prismaModelHasField("Order", "paymentProvider");
    const orderCreateData: Prisma.OrderUncheckedCreateInput = {
      tableId: table.id,
      items: validatedPayload.items,
      totalPrice: validatedPayload.totalPrice,
      requestedPaymentMethod: toDbPaymentMethod(normalizedPaymentMethod),
      paymentStatus: normalizedPaymentMethod === "IYZICO" ? "PENDING" : null,
      isRiskFlagged: riskResult.decision === "suspicious",
      riskScore: riskResult.score,
      riskLevel: riskResult.level,
      riskReasons: riskResult.reasons,
      status: "PENDING_WAITER_APPROVAL",
    };

    if (supportsOrderPaymentProvider) {
      orderCreateData.paymentProvider =
        normalizedPaymentMethod === "IYZICO" ? "IYZICO" : null;
    }

    const order = await prisma.$transaction(async (tx) => {
      for (const stockAdjustment of validatedPayload.stockAdjustments) {
        const stockUpdateResult = await tx.product.updateMany({
          where: {
            id: stockAdjustment.productId,
            trackStock: true,
            stockQuantity: { gte: stockAdjustment.quantity },
            category: {
              restaurant: {
                tenantId: sessionTenantId,
              },
            },
          },
          data: {
            stockQuantity: {
              decrement: stockAdjustment.quantity,
            },
          },
        });
        if (stockUpdateResult.count !== 1) {
          throw new TableSessionError(
            "NO_SESSION",
            "Stok bilgisi degisti. Lutfen sepetinizi guncelleyip tekrar deneyin.",
          );
        }
      }

      const createdOrder = await tx.order.create({
        data: orderCreateData,
      });

      if (validatedPayload.optionRows.length > 0) {
        await tx.orderItemOption.createMany({
          data: validatedPayload.optionRows.map((row) => ({
            orderId: createdOrder.id,
            productId: row.productId,
            optionId: row.optionId,
            quantity: row.quantity,
          })),
          skipDuplicates: true,
        });
      }

      return createdOrder;
    });

    let redirectUrl = appendTenantQuery(
      `/order-success/${order.id}`,
      restaurant.tenant?.slug ?? null,
    );
    let successMessage = "Siparişiniz alindi.";
    let paymentStatus: "PENDING" | "INITIATED" | "PAID" | "FAILED" | null = null;

    if (normalizedPaymentMethod === "IYZICO") {
      try {
        await assertOrderCheckoutInitRateLimit({
          tenantId: sessionTenantId,
          orderId: order.id,
          tableId: table.id,
          ipRaw: requestCtx.ipRaw,
        });
      } catch (error) {
        if (error instanceof DistributedRateLimitError) {
          await prisma.order.update({
            where: { id: order.id },
            data: { paymentStatus: "FAILED" },
          });
          opLog({
            tenantId: sessionTenantId,
            tableId: table.id,
            orderId: order.id,
            action: "IYZICO_CHECKOUT_INIT",
            result: "error",
            message: error.message,
          });
          return {
            success: false,
            message: error.message,
            orderId: order.id,
            rateLimit: {
              code: error.code,
              retryAfterSeconds: error.retryAfterSeconds,
            },
          };
        }

        throw error;
      }

      const requestHeaders = await headers();
      let callbackBaseUrl: string;
      try {
        callbackBaseUrl = resolveSafeAppBaseUrl({ headers: requestHeaders });
      } catch (error) {
        await prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: "FAILED" },
        });
        opLog({
          tenantId: sessionTenantId,
          tableId: table.id,
          orderId: order.id,
          action: "IYZICO_CHECKOUT_INIT",
          result: "error",
          message: "Secure callback origin validation failed.",
        });
        logServerError("createOrder:secure-callback-origin", error);
        return {
          success: false,
          message: "Kart odemesi baslatilamadi.",
          orderId: order.id,
        };
      }

      const checkout = await initializeIyzicoCheckoutForOrder({
        tenantId: sessionTenantId,
        orderId: order.id,
        tableNo: table.tableNo,
        totalAmount: validatedPayload.totalPrice,
        callbackBaseUrl,
        tenantSlug: restaurant.tenant?.slug ?? null,
      });

      if (!checkout.success) {
        await prisma.order.update({
          where: { id: order.id },
          data: { paymentStatus: "FAILED" },
        });
        opLog({
          tenantId: sessionTenantId,
          tableId: table.id,
          orderId: order.id,
          action: "IYZICO_CHECKOUT_INIT",
          result: "error",
          message: checkout.message,
        });
        return {
          success: false,
          message: checkout.message,
          orderId: order.id,
        };
      }

      await prisma.order.update({
        where: { id: order.id },
        data: {
          paymentStatus: "INITIATED",
          paymentReference: checkout.paymentToken,
          paymentConversationId: checkout.conversationId,
        },
      });

      redirectUrl = checkout.paymentPageUrl;
      successMessage = "Odeme sayfasina yonlendiriliyorsunuz.";
      paymentStatus = "INITIATED";
    }

    opLog({
      tenantId: sessionTenantId,
      tableId: table.id,
      orderId: order.id,
      action: "CREATE_ORDER",
      result: "ok",
    });

    if (riskResult.decision === "suspicious") {
      opLog({
        tenantId: sessionTenantId,
        tableId: table.id,
        orderId: order.id,
        action: "CREATE_ORDER_SUSPICIOUS",
        result: "ok",
        message: `risk=${riskResult.score}; reasons=${riskResult.reasons.join(",")}`,
      });
    }

    revalidatePath(`/${sessionTableId}`);
    revalidatePath("/restaurant/orders");

    return {
      success: true,
      message: successMessage,
      orderId: order.id,
      redirectUrl,
      paymentStatus,
    };
  } catch (error) {
    if (error instanceof TableSessionError) {
      opLog({ action: "CREATE_ORDER", result: "error", message: error.message });
      return { success: false, message: error.message };
    }
    if (error instanceof RateLimitError) {
      opLog({ action: "CREATE_ORDER", result: "error", message: error.message });
      return {
        success: false,
        message: error.message,
        rateLimit: {
          code: error.code,
          retryAfterSeconds: error.retryAfterSeconds,
        },
      };
    }

    opLog({
      action: "CREATE_ORDER",
      result: "error",
      message: error instanceof Error ? error.message : String(error),
    });
    return {
      success: false,
      message: "Sipariş oluşturulurken bir hata olustu.",
    };
  }
}

