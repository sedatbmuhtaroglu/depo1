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

function buildOrderResultUrl(params: {
  base: string;
  orderId: number;
  status: "paid" | "failed" | "error";
  reason?: string;
  paymentReference?: string | null;
}): string {
  const url = new URL(`/order-success/${params.orderId}`, params.base);
  url.searchParams.set("payment", params.status);
  if (params.reason) {
    url.searchParams.set("reason", params.reason);
  }
  if (params.paymentReference) {
    url.searchParams.set("paymentRef", params.paymentReference);
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
      failureMode: "fail-open",
    });
  } catch (error) {
    if (error instanceof DistributedRateLimitError) {
      return new NextResponse("Callback request could not be processed.", { status: 429 });
    }
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
        return NextResponse.redirect(
          buildOrderResultUrl({
            base,
            orderId: fallbackOrder.id,
            status: "paid",
            paymentReference: fallbackOrder.paymentReference ?? null,
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
    return NextResponse.redirect(buildGenericErrorUrl(base, "order_not_found"));
  }

  if (order.paymentStatus === "PAID") {
    return NextResponse.redirect(
      buildOrderResultUrl({
        base,
        orderId: order.id,
        status: "paid",
        paymentReference: order.paymentReference ?? null,
      }),
    );
  }

  if (parsedOrderId && parsedOrderId !== order.id) {
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "FAILED" },
    });
    return NextResponse.redirect(
      buildOrderResultUrl({
        base,
        orderId: order.id,
        status: "error",
        reason: "order_mismatch",
        paymentReference: order.paymentReference ?? null,
      }),
    );
  }

  if (order.paymentReference !== token) {
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "FAILED" },
    });
    return NextResponse.redirect(
      buildOrderResultUrl({
        base,
        orderId: order.id,
        status: "failed",
        reason: "token_mismatch",
        paymentReference: order.paymentReference ?? null,
      }),
    );
  }

  const tenantId = order.table.restaurant.tenantId;
  if (!tenantId) {
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "FAILED" },
    });
    return NextResponse.redirect(
      buildOrderResultUrl({
        base,
        orderId: order.id,
        status: "error",
        reason: "tenant_missing",
        paymentReference: order.paymentReference ?? null,
      }),
    );
  }

  const onlinePaymentEnabled = await hasFeature(tenantId, "ONLINE_PAYMENT_IYZICO");
  if (!onlinePaymentEnabled) {
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "FAILED" },
    });
    return NextResponse.redirect(
      buildOrderResultUrl({
        base,
        orderId: order.id,
        status: "error",
        reason: "online_payment_disabled",
        paymentReference: order.paymentReference ?? null,
      }),
    );
  }

  const iyzicoConfig = await getIyzicoConfigForTenant(tenantId);
  if (!iyzicoConfig) {
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "FAILED" },
    });
    return NextResponse.redirect(
      buildOrderResultUrl({
        base,
        orderId: order.id,
        status: "error",
        reason: "config_missing",
        paymentReference: order.paymentReference ?? null,
      }),
    );
  }

  const retrieve = await retrieveCheckoutForm(
    token,
    iyzicoConfig,
    order.paymentConversationId ?? undefined,
  );
  if (retrieve.status !== "success") {
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "FAILED" },
    });
    return NextResponse.redirect(
      buildOrderResultUrl({
        base,
        orderId: order.id,
        status: "failed",
        reason: "retrieve_failed",
        paymentReference: order.paymentReference ?? null,
      }),
    );
  }

  if (
    retrieve.conversationId &&
    order.paymentConversationId &&
    retrieve.conversationId !== order.paymentConversationId
  ) {
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "FAILED" },
    });
    return NextResponse.redirect(
      buildOrderResultUrl({
        base,
        orderId: order.id,
        status: "error",
        reason: "conversation_mismatch",
        paymentReference: order.paymentReference ?? null,
      }),
    );
  }

  if (retrieve.paymentStatus !== "SUCCESS") {
    await prisma.order.update({
      where: { id: order.id },
      data: { paymentStatus: "FAILED" },
    });
    return NextResponse.redirect(
      buildOrderResultUrl({
        base,
        orderId: order.id,
        status: "failed",
        reason: "not_success",
        paymentReference: order.paymentReference ?? null,
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
