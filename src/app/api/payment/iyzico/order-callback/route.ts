import { NextRequest, NextResponse } from "next/server";
import { prisma, prismaModelHasField } from "@/lib/prisma";
import { retrieveCheckoutForm } from "@/lib/iyzico";
import { getIyzicoConfigForTenant } from "@/lib/iyzico-config";
import { AppOriginSecurityError, resolveSafeAppBaseUrl } from "@/lib/security/allowed-origins";
import { DistributedRateLimitError } from "@/lib/security/distributed-rate-limit";
import {
  assertPaymentCallbackAbuseGuard,
  resolveClientIpFromHeaders,
} from "@/lib/security/payment-rate-limit";
import { writeAuditLog } from "@/lib/audit-log";
import { revalidatePath } from "next/cache";
import { hasFeature } from "@/core/entitlements/engine";
import { opLog } from "@/lib/op-logger";
import { hashValue } from "@/lib/security/hash";
import { createOrderSuccessAccessProof } from "@/lib/order-success-access";

const MONEY_EPSILON = 0.01;

function normalizeMoney(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

function buildOrderResultUrl(params: {
  base: string;
  orderId: number;
  status: "paid" | "failed" | "error";
  reason?: string;
  paymentReference?: string | null;
  accessProof?: string | null;
}): string {
  const url = new URL(`/order-success/${params.orderId}`, params.base);
  url.searchParams.set("payment", params.status);
  if (params.reason) {
    url.searchParams.set("reason", params.reason);
  }
  if (params.paymentReference) {
    url.searchParams.set("paymentRef", params.paymentReference);
  }
  if (params.accessProof) {
    url.searchParams.set("accessProof", params.accessProof);
  }
  return url.toString();
}

function buildGenericErrorUrl(base: string, reason: string): string {
  const url = new URL("/", base);
  url.searchParams.set("payment", "error");
  url.searchParams.set("reason", reason);
  return url.toString();
}

function buildInvalidCallbackResponse(error: AppOriginSecurityError): NextResponse {
  if (process.env.NODE_ENV !== "production") {
    console.warn("iyzico order-callback host validation failed", error.code, error.message);
  } else {
    console.warn("iyzico order-callback host validation failed", error.code);
  }
  const isRequestHostError =
    error.code === "REQUEST_HOST_INVALID" || error.code === "REQUEST_HOST_NOT_ALLOWED";
  return new NextResponse("Invalid callback request.", { status: isRequestHostError ? 400 : 500 });
}

function logOrderCallbackSecurityEvent(input: {
  action: string;
  result: "ok" | "error";
  tenantId?: number;
  orderId?: number;
  token?: string | null;
  message?: string;
}) {
  const tokenHash = hashValue(input.token ?? null);
  opLog({
    tenantId: input.tenantId,
    orderId: input.orderId,
    action: input.action,
    result: input.result,
    message: `${input.message ?? ""}${tokenHash ? `; tokenHash=${tokenHash.slice(0, 12)}` : ""}`,
  });
}

const orderCallbackInclude = {
  table: {
    include: {
      restaurant: {
        select: {
          tenantId: true,
        },
      },
    },
  },
} as const;

async function handleOrderCallback(
  request: NextRequest,
  token: string | null,
  orderIdParam: string | null,
) {
  let base: string;
  try {
    base = resolveSafeAppBaseUrl({ request });
  } catch (error) {
    if (error instanceof AppOriginSecurityError) {
      return buildInvalidCallbackResponse(error);
    }
    throw error;
  }

  try {
    await assertPaymentCallbackAbuseGuard({
      channel: "order",
      token,
      ipRaw: resolveClientIpFromHeaders(request.headers),
      failureMode: "fail-closed",
    });
  } catch (error) {
    if (error instanceof DistributedRateLimitError) {
      logOrderCallbackSecurityEvent({
        action: "ORDER_CALLBACK_GUARD_REJECTED",
        result: "error",
        token,
        message: `code=${error.code}`,
      });
      return new NextResponse("Callback request could not be processed.", { status: 429 });
    }
    logOrderCallbackSecurityEvent({
      action: "ORDER_CALLBACK_GUARD_ERROR",
      result: "error",
      token,
      message: "unexpected_guard_error",
    });
    throw error;
  }

  const supportsOrderPaymentProvider = prismaModelHasField("Order", "paymentProvider");
  const parsedOrderId =
    orderIdParam && Number.isInteger(Number(orderIdParam))
      ? Number(orderIdParam)
      : null;

  if (!token) {
    if (parsedOrderId) {
      const fallbackOrder = await prisma.order.findUnique({
        where: { id: parsedOrderId },
        include: orderCallbackInclude,
      });
      if (fallbackOrder?.paymentStatus === "PAID") {
        const fallbackAccessProof = createOrderSuccessAccessProof({
          orderId: fallbackOrder.id,
          tenantId: fallbackOrder.table.restaurant.tenantId,
          paymentReference: fallbackOrder.paymentReference,
        });
        return NextResponse.redirect(
          buildOrderResultUrl({
            base,
            orderId: fallbackOrder.id,
            status: "paid",
            paymentReference: fallbackOrder.paymentReference ?? null,
            accessProof: fallbackAccessProof,
          }),
        );
      }
    }
    return NextResponse.redirect(buildGenericErrorUrl(base, "missing_token"));
  }

  let order = await prisma.order.findFirst({
    where: {
      paymentReference: token,
      ...(supportsOrderPaymentProvider ? { paymentProvider: "IYZICO" as const } : {}),
    },
    include: orderCallbackInclude,
  });

  if (!order && parsedOrderId) {
    order = await prisma.order.findFirst({
      where: {
        id: parsedOrderId,
        ...(supportsOrderPaymentProvider ? { paymentProvider: "IYZICO" as const } : {}),
      },
      include: orderCallbackInclude,
    });
  }

  if (!order) {
    logOrderCallbackSecurityEvent({
      action: "ORDER_CALLBACK_ORDER_NOT_FOUND",
      result: "error",
      token,
      message: "order_not_found",
    });
    return NextResponse.redirect(buildGenericErrorUrl(base, "order_not_found"));
  }

  const accessProof = createOrderSuccessAccessProof({
    orderId: order.id,
    tenantId: order.table.restaurant.tenantId,
    paymentReference: order.paymentReference,
  });

  if (order.paymentStatus === "PAID") {
    return NextResponse.redirect(
      buildOrderResultUrl({
        base,
        orderId: order.id,
        status: "paid",
        paymentReference: order.paymentReference ?? null,
        accessProof,
      }),
    );
  }

  if (order.paymentStatus !== "INITIATED" && order.paymentStatus !== "PENDING") {
    logOrderCallbackSecurityEvent({
      action: "ORDER_CALLBACK_REJECTED_INVALID_PAYMENT_STATE",
      result: "error",
      tenantId: order.table.restaurant.tenantId,
      orderId: order.id,
      token,
      message: `paymentStatus=${order.paymentStatus ?? "null"}`,
    });
    return NextResponse.redirect(
      buildOrderResultUrl({
        base,
        orderId: order.id,
        status: "error",
        reason: "invalid_payment_state",
        paymentReference: order.paymentReference ?? null,
        accessProof,
      }),
    );
  }

  if (parsedOrderId && parsedOrderId !== order.id) {
    logOrderCallbackSecurityEvent({
      action: "ORDER_CALLBACK_REJECTED_ORDER_MISMATCH",
      result: "error",
      tenantId: order.table.restaurant.tenantId,
      orderId: order.id,
      token,
      message: "order_mismatch",
    });
    return NextResponse.redirect(
      buildOrderResultUrl({
        base,
        orderId: order.id,
        status: "error",
        reason: "order_mismatch",
        paymentReference: order.paymentReference ?? null,
        accessProof,
      }),
    );
  }

  if (order.paymentReference !== token) {
    logOrderCallbackSecurityEvent({
      action: "ORDER_CALLBACK_REJECTED_TOKEN_MISMATCH",
      result: "error",
      tenantId: order.table.restaurant.tenantId,
      orderId: order.id,
      token,
      message: "token_mismatch",
    });
    return NextResponse.redirect(
      buildOrderResultUrl({
        base,
        orderId: order.id,
        status: "failed",
        reason: "token_mismatch",
        paymentReference: order.paymentReference ?? null,
        accessProof,
      }),
    );
  }

  const tenantId = order.table.restaurant.tenantId;
  if (!tenantId) {
    logOrderCallbackSecurityEvent({
      action: "ORDER_CALLBACK_REJECTED_TENANT_MISSING",
      result: "error",
      orderId: order.id,
      token,
      message: "tenant_missing",
    });
    return NextResponse.redirect(
      buildOrderResultUrl({
        base,
        orderId: order.id,
        status: "error",
        reason: "tenant_missing",
        paymentReference: order.paymentReference ?? null,
        accessProof,
      }),
    );
  }

  const onlinePaymentEnabled = await hasFeature(tenantId, "ONLINE_PAYMENT_IYZICO");
  if (!onlinePaymentEnabled) {
    logOrderCallbackSecurityEvent({
      action: "ORDER_CALLBACK_REJECTED_PAYMENT_DISABLED",
      result: "error",
      tenantId,
      orderId: order.id,
      token,
      message: "online_payment_disabled",
    });
    return NextResponse.redirect(
      buildOrderResultUrl({
        base,
        orderId: order.id,
        status: "error",
        reason: "online_payment_disabled",
        paymentReference: order.paymentReference ?? null,
        accessProof,
      }),
    );
  }

  const iyzicoConfig = await getIyzicoConfigForTenant(tenantId);
  if (!iyzicoConfig) {
    logOrderCallbackSecurityEvent({
      action: "ORDER_CALLBACK_REJECTED_CONFIG_MISSING",
      result: "error",
      tenantId,
      orderId: order.id,
      token,
      message: "config_missing",
    });
    return NextResponse.redirect(
      buildOrderResultUrl({
        base,
        orderId: order.id,
        status: "error",
        reason: "config_missing",
        paymentReference: order.paymentReference ?? null,
        accessProof,
      }),
    );
  }

  const retrieve = await retrieveCheckoutForm(
    token,
    iyzicoConfig,
    order.paymentConversationId ?? undefined,
  );
  if (retrieve.status !== "success") {
    logOrderCallbackSecurityEvent({
      action: "ORDER_CALLBACK_REJECTED_RETRIEVE_FAILED",
      result: "error",
      tenantId,
      orderId: order.id,
      token,
      message: "retrieve_failed",
    });
    return NextResponse.redirect(
      buildOrderResultUrl({
        base,
        orderId: order.id,
        status: "failed",
        reason: "retrieve_failed",
        paymentReference: order.paymentReference ?? null,
        accessProof,
      }),
    );
  }

  if (
    retrieve.conversationId &&
    order.paymentConversationId &&
    retrieve.conversationId !== order.paymentConversationId
  ) {
    logOrderCallbackSecurityEvent({
      action: "ORDER_CALLBACK_REJECTED_CONVERSATION_MISMATCH",
      result: "error",
      tenantId,
      orderId: order.id,
      token,
      message: "conversation_mismatch",
    });
    return NextResponse.redirect(
      buildOrderResultUrl({
        base,
        orderId: order.id,
        status: "error",
        reason: "conversation_mismatch",
        paymentReference: order.paymentReference ?? null,
        accessProof,
      }),
    );
  }

  if (retrieve.paymentStatus !== "SUCCESS") {
    logOrderCallbackSecurityEvent({
      action: "ORDER_CALLBACK_PAYMENT_NOT_SUCCESS",
      result: "error",
      tenantId,
      orderId: order.id,
      token,
      message: "not_success",
    });
    return NextResponse.redirect(
      buildOrderResultUrl({
        base,
        orderId: order.id,
        status: "failed",
        reason: "not_success",
        paymentReference: order.paymentReference ?? null,
        accessProof,
      }),
    );
  }

  const paidPrice = normalizeMoney(retrieve.paidPrice);
  const expectedAmount = normalizeMoney(order.totalPrice);
  if (
    paidPrice == null ||
    expectedAmount == null ||
    Math.abs(paidPrice - expectedAmount) > MONEY_EPSILON
  ) {
    logOrderCallbackSecurityEvent({
      action: "ORDER_CALLBACK_REJECTED_AMOUNT_MISMATCH",
      result: "error",
      tenantId,
      orderId: order.id,
      token,
      message: `expected=${expectedAmount ?? "n/a"}; paid=${paidPrice ?? "n/a"}`,
    });
    return NextResponse.redirect(
      buildOrderResultUrl({
        base,
        orderId: order.id,
        status: "error",
        reason: "amount_mismatch",
        paymentReference: order.paymentReference ?? null,
        accessProof,
      }),
    );
  }

  const providerPaymentId = retrieve.paymentId?.trim() ?? "";
  if (!providerPaymentId) {
    logOrderCallbackSecurityEvent({
      action: "ORDER_CALLBACK_REJECTED_MISSING_PAYMENT_ID",
      result: "error",
      tenantId,
      orderId: order.id,
      token,
      message: "missing_payment_id",
    });
    return NextResponse.redirect(
      buildOrderResultUrl({
        base,
        orderId: order.id,
        status: "error",
        reason: "missing_payment_id",
        paymentReference: order.paymentReference ?? null,
        accessProof,
      }),
    );
  }

  // Payment successfully confirmed:
  // - paymentStatus -> PAID
  // - For online Iyzico orders, bypass waiter approval by moving order workflow to PENDING
  //   so it becomes visible in kitchen (which shows PENDING/PREPARING).
  // Idempotency: only update status when it's still waiting for waiter approval.
  const statusTransitionedToPending = await prisma.$transaction(async (tx) => {
    const paymentUpdated = await tx.order.updateMany({
      where: { id: order.id, paymentStatus: { not: "PAID" } },
      data: { paymentStatus: "PAID" },
    });

    const statusUpdated = await tx.order.updateMany({
      where: { id: order.id, status: "PENDING_WAITER_APPROVAL" },
      data: { status: "PENDING" },
    });

    void paymentUpdated;
    return statusUpdated.count > 0;
  });

  if (statusTransitionedToPending && tenantId) {
    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: "payment-callback" },
      actionType: "ORDER_STATUS",
      entityType: "Order",
      entityId: String(order.id),
      description: "PENDING",
    });

    // Keep operational panels in sync without waiting for polling/refresh.
    revalidatePath("/kitchen");
    revalidatePath("/waiter");
    revalidatePath("/restaurant");
    revalidatePath("/admin/orders");
  }

  return NextResponse.redirect(
    buildOrderResultUrl({
      base,
      orderId: order.id,
      status: "paid",
      paymentReference: order.paymentReference ?? null,
      accessProof,
    }),
  );
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  const orderId = request.nextUrl.searchParams.get("orderId");
  return handleOrderCallback(request, token, orderId);
}

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  let token: string | null = null;
  let orderId: string | null = request.nextUrl.searchParams.get("orderId");

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    token = (form.get("token") as string | null) ?? null;
    if (!orderId) {
      orderId = (form.get("orderId") as string | null) ?? null;
    }
  } else {
    const json = await request.json().catch(() => ({}));
    token = (json as { token?: string }).token ?? null;
    if (!orderId) {
      orderId = (json as { orderId?: string }).orderId ?? null;
    }
  }

  return handleOrderCallback(request, token, orderId);
}
