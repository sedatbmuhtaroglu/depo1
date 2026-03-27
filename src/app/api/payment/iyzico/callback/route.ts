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

const WAITER_URL = "/waiter";

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
      failureMode: "fail-open",
    });
  } catch (error) {
    if (error instanceof DistributedRateLimitError) {
      return new NextResponse("Callback request could not be processed.", { status: 429 });
    }
    throw error;
  }

  if (!token) {
    return NextResponse.redirect(buildWaiterRedirectUrl(base, { status: "error", reason: "missing_token" }));
  }

  const intent = await prisma.paymentIntent.findUnique({
    where: { gatewayToken: token, status: "PENDING" },
    include: { billRequest: true },
  });

  if (!intent) {
    return NextResponse.redirect(buildWaiterRedirectUrl(base, { status: "error", reason: "invalid_token" }));
  }

  const onlinePaymentEnabled = await hasFeature(intent.tenantId, "ONLINE_PAYMENT_IYZICO");
  if (!onlinePaymentEnabled) {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: "FAILED" },
    });
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
  const retrieve = await retrieveCheckoutForm(token, iyzicoConfig ?? undefined);

  if (retrieve.status !== "success") {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: "FAILED" },
    });

    return NextResponse.redirect(
      buildWaiterRedirectUrl(base, { status: "failed", reason: "retrieve_failed" }),
    );
  }

  if (retrieve.paymentStatus !== "SUCCESS") {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: "FAILED" },
    });

    return NextResponse.redirect(
      buildWaiterRedirectUrl(base, { status: "failed", reason: "not_success" }),
    );
  }

  const amount = Number(intent.amount);
  const gatewayPaymentId = retrieve.paymentId ?? token;

  const settleResult = await completeGatewaySettlement({
    tenantId: intent.tenantId,
    billRequestId: intent.billRequestId,
    amount,
    gatewayPaymentId,
  });

  if (!settleResult.success) {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: "FAILED" },
    });

    return NextResponse.redirect(buildWaiterRedirectUrl(base, { status: "error", reason: "settle_failed" }));
  }

  await prisma.paymentIntent.update({
    where: { id: intent.id },
    data: { status: "SUCCESS" },
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
