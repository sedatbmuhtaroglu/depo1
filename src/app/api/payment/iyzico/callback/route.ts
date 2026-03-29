import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { retrieveCheckoutForm } from "@/lib/iyzico";
import { completeGatewaySettlement } from "@/lib/settle-bill-gateway";
import { getIyzicoConfigForTenant } from "@/lib/iyzico-config";
import { AppOriginSecurityError, resolveSafeAppBaseUrl } from "@/lib/security/allowed-origins";
import { DistributedRateLimitError } from "@/lib/security/distributed-rate-limit";
import {
  assertPaymentCallbackAbuseGuard,
  resolveClientIpFromHeaders,
} from "@/lib/security/payment-rate-limit";
import { hasFeature } from "@/core/entitlements/engine";
import { opLog } from "@/lib/op-logger";
import { hashValue } from "@/lib/security/hash";

const WAITER_URL = "/waiter";
const MONEY_EPSILON = 0.01;

function buildWaiterRedirectUrl(
  base: string,
  params: { status: "success" | "failed" | "error"; reason?: string },
): string {
  const url = new URL(WAITER_URL, base);
  url.searchParams.set("payment", params.status);
  if (params.reason) {
    url.searchParams.set("reason", params.reason);
  }
  return url.toString();
}

function buildMockRedirectUrl(
  base: string,
  params: { status: "success" | "failed"; token: string },
): string {
  const url = new URL("/payment/iyzico/mock", base);
  url.searchParams.set("status", params.status);
  url.searchParams.set("token", params.token);
  return url.toString();
}

function buildInvalidCallbackResponse(error: AppOriginSecurityError): NextResponse {
  if (process.env.NODE_ENV !== "production") {
    console.warn("iyzico callback host validation failed", error.code, error.message);
  } else {
    console.warn("iyzico callback host validation failed", error.code);
  }
  const isRequestHostError =
    error.code === "REQUEST_HOST_INVALID" || error.code === "REQUEST_HOST_NOT_ALLOWED";
  return new NextResponse("Invalid callback request.", { status: isRequestHostError ? 400 : 500 });
}

function logBillCallbackSecurityEvent(input: {
  action: string;
  result: "ok" | "error";
  tenantId?: number;
  billRequestId?: number;
  token?: string | null;
  message?: string;
}) {
  const tokenHash = hashValue(input.token ?? null);
  opLog({
    tenantId: input.tenantId,
    billRequestId: input.billRequestId,
    action: input.action,
    result: input.result,
    message: `${input.message ?? ""}${tokenHash ? `; tokenHash=${tokenHash.slice(0, 12)}` : ""}`,
  });
}

function normalizeMoney(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

async function handleIyzicoCallback(request: NextRequest, token: string | null) {
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
      channel: "bill",
      token,
      ipRaw: resolveClientIpFromHeaders(request.headers),
      failureMode: "fail-closed",
    });
  } catch (error) {
    if (error instanceof DistributedRateLimitError) {
      logBillCallbackSecurityEvent({
        action: "BILL_CALLBACK_GUARD_REJECTED",
        result: "error",
        token,
        message: `code=${error.code}`,
      });
      return new NextResponse("Callback request could not be processed.", { status: 429 });
    }
    logBillCallbackSecurityEvent({
      action: "BILL_CALLBACK_GUARD_ERROR",
      result: "error",
      token,
      message: "unexpected_guard_error",
    });
    throw error;
  }

  if (!token) {
    return NextResponse.redirect(buildWaiterRedirectUrl(base, { status: "error", reason: "missing_token" }));
  }
  const billRequestIdParam = request.nextUrl.searchParams.get("billRequestId");
  const expectedBillRequestId =
    billRequestIdParam && Number.isInteger(Number(billRequestIdParam))
      ? Number(billRequestIdParam)
      : null;

  const intent = await prisma.paymentIntent.findUnique({
    where: { gatewayToken: token },
    include: {
      billRequest: {
        select: {
          id: true,
          tenantId: true,
          tableId: true,
          status: true,
        },
      },
    },
  });

  if (!intent || !intent.billRequest) {
    logBillCallbackSecurityEvent({
      action: "BILL_CALLBACK_INVALID_TOKEN",
      result: "error",
      token,
      message: "invalid_token",
    });
    return NextResponse.redirect(buildWaiterRedirectUrl(base, { status: "error", reason: "invalid_token" }));
  }

  if (intent.status === "SUCCESS") {
    return NextResponse.redirect(buildWaiterRedirectUrl(base, { status: "success" }));
  }
  if (intent.status !== "PENDING") {
    return NextResponse.redirect(buildWaiterRedirectUrl(base, { status: "failed", reason: "intent_not_pending" }));
  }

  if (intent.billRequest.tenantId !== intent.tenantId) {
    logBillCallbackSecurityEvent({
      action: "BILL_CALLBACK_TENANT_MISMATCH",
      result: "error",
      tenantId: intent.tenantId,
      billRequestId: intent.billRequestId,
      token,
      message: "intent_bill_tenant_mismatch",
    });
    return NextResponse.redirect(
      buildWaiterRedirectUrl(base, { status: "error", reason: "tenant_mismatch" }),
    );
  }
  if (expectedBillRequestId != null && expectedBillRequestId !== intent.billRequestId) {
    logBillCallbackSecurityEvent({
      action: "BILL_CALLBACK_REQUEST_MISMATCH",
      result: "error",
      tenantId: intent.tenantId,
      billRequestId: intent.billRequestId,
      token,
      message: `expected=${expectedBillRequestId}; actual=${intent.billRequestId}`,
    });
    return NextResponse.redirect(
      buildWaiterRedirectUrl(base, { status: "error", reason: "bill_request_mismatch" }),
    );
  }

  if (intent.billRequest.status !== "PENDING" && intent.billRequest.status !== "ACKNOWLEDGED") {
    return NextResponse.redirect(
      buildWaiterRedirectUrl(base, { status: "failed", reason: "bill_not_payable" }),
    );
  }

  const onlinePaymentEnabled = await hasFeature(intent.tenantId, "ONLINE_PAYMENT_IYZICO");
  if (!onlinePaymentEnabled) {
    return NextResponse.redirect(
      buildWaiterRedirectUrl(base, { status: "error", reason: "online_payment_disabled" }),
    );
  }

  if (token.startsWith("mock_")) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.redirect(
        buildWaiterRedirectUrl(base, { status: "error", reason: "invalid_token" }),
      );
    }
    const amount = Number(intent.amount);
    const settleResult = await completeGatewaySettlement({
      tenantId: intent.tenantId,
      billRequestId: intent.billRequestId,
      amount,
      gatewayPaymentId: token,
    });

    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: settleResult.success ? "SUCCESS" : "FAILED" },
    });

    if (!settleResult.success) {
      return NextResponse.redirect(
        buildMockRedirectUrl(base, { status: "failed", token }),
      );
    }

    return NextResponse.redirect(
      buildMockRedirectUrl(base, { status: "success", token }),
    );
  }

  const iyzicoConfig = await getIyzicoConfigForTenant(intent.tenantId);
  if (!iyzicoConfig) {
    logBillCallbackSecurityEvent({
      action: "BILL_CALLBACK_CONFIG_MISSING",
      result: "error",
      tenantId: intent.tenantId,
      billRequestId: intent.billRequestId,
      token,
      message: "config_missing",
    });
    return NextResponse.redirect(
      buildWaiterRedirectUrl(base, { status: "error", reason: "config_missing" }),
    );
  }

  const expectedConversationId = intent.gatewayConversationId?.trim() ?? "";
  const retrieve = await retrieveCheckoutForm(
    token,
    iyzicoConfig,
    expectedConversationId || undefined,
  );

  if (retrieve.status !== "success") {
    return NextResponse.redirect(
      buildWaiterRedirectUrl(base, { status: "failed", reason: "retrieve_failed" }),
    );
  }

  if (expectedConversationId) {
    if (!retrieve.conversationId || retrieve.conversationId !== expectedConversationId) {
      logBillCallbackSecurityEvent({
        action: "BILL_CALLBACK_CONVERSATION_MISMATCH",
        result: "error",
        tenantId: intent.tenantId,
        billRequestId: intent.billRequestId,
        token,
        message: "conversation_mismatch",
      });
      return NextResponse.redirect(
        buildWaiterRedirectUrl(base, { status: "error", reason: "conversation_mismatch" }),
      );
    }
  } else if (
    retrieve.conversationId &&
    !retrieve.conversationId.startsWith(`bill-${intent.billRequestId}-`)
  ) {
    logBillCallbackSecurityEvent({
      action: "BILL_CALLBACK_CONVERSATION_UNEXPECTED",
      result: "error",
      tenantId: intent.tenantId,
      billRequestId: intent.billRequestId,
      token,
      message: "conversation_unexpected",
    });
    return NextResponse.redirect(
      buildWaiterRedirectUrl(base, { status: "error", reason: "conversation_unexpected" }),
    );
  }

  if (retrieve.paymentStatus !== "SUCCESS") {
    await prisma.paymentIntent.updateMany({
      where: { id: intent.id, status: "PENDING" },
      data: { status: "FAILED" },
    });
    return NextResponse.redirect(
      buildWaiterRedirectUrl(base, { status: "failed", reason: "not_success" }),
    );
  }

  const paidPrice = normalizeMoney(retrieve.paidPrice);
  const expectedAmount = normalizeMoney(intent.amount);
  if (
    paidPrice == null ||
    expectedAmount == null ||
    Math.abs(paidPrice - expectedAmount) > MONEY_EPSILON
  ) {
    logBillCallbackSecurityEvent({
      action: "BILL_CALLBACK_AMOUNT_MISMATCH",
      result: "error",
      tenantId: intent.tenantId,
      billRequestId: intent.billRequestId,
      token,
      message: `expected=${expectedAmount ?? "n/a"}; paid=${paidPrice ?? "n/a"}`,
    });
    return NextResponse.redirect(
      buildWaiterRedirectUrl(base, { status: "error", reason: "amount_mismatch" }),
    );
  }

  const amount = Number(intent.amount);
  const gatewayPaymentId = retrieve.paymentId?.trim() ?? "";
  if (!gatewayPaymentId) {
    logBillCallbackSecurityEvent({
      action: "BILL_CALLBACK_MISSING_PAYMENT_ID",
      result: "error",
      tenantId: intent.tenantId,
      billRequestId: intent.billRequestId,
      token,
      message: "missing_payment_id",
    });
    return NextResponse.redirect(
      buildWaiterRedirectUrl(base, { status: "error", reason: "missing_payment_id" }),
    );
  }

  const settleResult = await completeGatewaySettlement({
    tenantId: intent.tenantId,
    billRequestId: intent.billRequestId,
    amount,
    gatewayPaymentId,
  });

  if (!settleResult.success) {
    await prisma.paymentIntent.updateMany({
      where: { id: intent.id, status: "PENDING" },
      data: { status: "FAILED" },
    });

    return NextResponse.redirect(buildWaiterRedirectUrl(base, { status: "error", reason: "settle_failed" }));
  }

  await prisma.paymentIntent.updateMany({
    where: { id: intent.id, status: "PENDING" },
    data: {
      status: "SUCCESS",
      gatewayPaymentId,
      callbackVerifiedAt: new Date(),
    },
  });

  return NextResponse.redirect(buildWaiterRedirectUrl(base, { status: "success" }));
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  return handleIyzicoCallback(request, token);
}

export async function POST(request: NextRequest) {
  let token: string | null = null;
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const form = await request.formData();
    token = (form.get("token") as string | null) ?? null;
  } else {
    const json = await request.json().catch(() => ({}));
    token = (json as { token?: string }).token ?? null;
  }

  return handleIyzicoCallback(request, token);
}
