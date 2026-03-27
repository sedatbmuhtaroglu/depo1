"use server";

import { headers } from "next/headers";
import { requireWaiterOrManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { createCheckoutFormInitialize } from "@/lib/iyzico";
import { getIyzicoConfigForTenant } from "@/lib/iyzico-config";
import { prisma } from "@/lib/prisma";
import { buildSafeAppUrl } from "@/lib/security/allowed-origins";
import { DistributedRateLimitError } from "@/lib/security/distributed-rate-limit";
import {
  assertCheckoutCreateRateLimit,
  resolveClientIpFromHeaders,
} from "@/lib/security/payment-rate-limit";
import { logServerError } from "@/lib/server-error-log";
import { hasFeature } from "@/core/entitlements/engine";

export async function createIyzicoCheckout(options: {
  billRequestId: number;
  amount: number;
  tableNo: number;
}) {
  const { billRequestId, amount, tableNo } = options;

  if (!amount || amount <= 0 || !Number.isFinite(amount)) {
    return { success: false, message: "Geçerli bir tutar giriniz." };
  }

  try {
    const { tenantId } = await requireWaiterOrManagerSession();
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) {
      return { success: false, message: "Yetkisiz." };
    }

    const onlinePaymentEnabled = await hasFeature(tenantId, "ONLINE_PAYMENT_IYZICO");
    if (!onlinePaymentEnabled) {
      return {
        success: false,
        message: "Bu ozellige erismek icin lutfen Catal App ile iletisime gecin.",
      };
    }

    const iyzicoConfig = await getIyzicoConfigForTenant(tenantId);
    if (!iyzicoConfig) {
      return {
        success: false,
        message:
          "Kart ile ödeme şu an yapılandırılmamış veya kapalı. Ayarlardan ödeme yöntemlerini kontrol edin.",
      };
    }

    const bill = await prisma.billRequest.findFirst({
      where: { id: billRequestId, tenantId },
      include: { table: true },
    });

    if (!bill) {
      return { success: false, message: "Hesap isteği bulunamadı." };
    }
    if (bill.status === "SETTLED") {
      return { success: false, message: "Bu hesap zaten kapatılmış." };
    }
    if (bill.status === "CANCELED") {
      return { success: false, message: "İptal edilmiş hesap için ödeme başlatılamaz." };
    }

    const requestHeaders = await headers();
    const ipRaw = resolveClientIpFromHeaders(requestHeaders);

    await assertCheckoutCreateRateLimit({
      tenantId,
      billRequestId,
      tableId: bill.tableId,
      ipRaw,
    });

    const callbackUrl = buildSafeAppUrl("/api/payment/iyzico/callback", {
      headers: requestHeaders,
    });
    const priceStr = amount.toFixed(2);
    const conversationId = `bill-${billRequestId}-${Date.now()}`;
    const basketId = `B${billRequestId}-${Date.now()}`;

    const result = await createCheckoutFormInitialize(
      {
        conversationId,
        price: priceStr,
        paidPrice: priceStr,
        basketId,
        callbackUrl,
        buyer: {
          id: `T${bill.tableId}`,
          name: "Masa",
          surname: String(tableNo),
          email: `bill-${billRequestId}-table-${tableNo}@example.com`,
          identityNumber: "11111111110",
          gsmNumber: "+905350000000",
          registrationAddress: "Restoran",
          city: "Istanbul",
          country: "Turkey",
          zipCode: "34000",
        },
        shippingAddress: {
          contactName: `Masa ${tableNo}`,
          city: "Istanbul",
          country: "Turkey",
          address: "Restoran",
          zipCode: "34000",
        },
        billingAddress: {
          contactName: `Masa ${tableNo}`,
          city: "Istanbul",
          country: "Turkey",
          address: "Restoran",
          zipCode: "34000",
        },
        basketItems: [
          {
            id: `BI-${billRequestId}`,
            name: `Hesap - Masa ${tableNo}`,
            category1: "Restoran",
            category2: "Hesap",
            itemType: "VIRTUAL",
            price: priceStr,
          },
        ],
      },
      iyzicoConfig,
    );

    if (result.status !== "success" || !result.token) {
      return {
        success: false,
        message: result.errorMessage ?? "Ödeme sayfası oluşturulamadı.",
      };
    }

    await prisma.paymentIntent.create({
      data: {
        tenantId,
        billRequestId,
        amount,
        currency: "TRY",
        gatewayToken: result.token,
        gatewayProvider: "IYZICO",
        status: "PENDING",
      },
    });

    const paymentPageUrl =
      result.paymentPageUrl ??
      `https://sandbox-merchant.iyzipay.com/tr/odeme/form?token=${result.token}`;

    return {
      success: true,
      paymentPageUrl,
    };
  } catch (error) {
    if (error instanceof DistributedRateLimitError) {
      return {
        success: false,
        message: error.message,
      };
    }

    logServerError("createIyzicoCheckout", error);
    return {
      success: false,
      message: "Ödeme başlatılamadı.",
    };
  }
}
