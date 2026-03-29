import { createRefund, retrieveCheckoutForm } from "@/lib/iyzico";
import { getIyzicoConfigForTenant } from "@/lib/iyzico-config";

export async function refundPaidIyzicoOrder(params: {
  tenantId: number;
  orderId: number;
  amount: number;
  paymentReference: string | null;
  paymentConversationId: string | null;
}) {
  const { tenantId, orderId, amount, paymentReference, paymentConversationId } = params;

  if (!paymentReference) {
    return {
      success: false as const,
      message: "Iyzico odeme referansi bulunamadi.",
    };
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      success: false as const,
      message: "Iade tutari gecersiz.",
    };
  }

  const iyzicoConfig = await getIyzicoConfigForTenant(tenantId);
  if (!iyzicoConfig) {
    return {
      success: false as const,
      message: "Iyzico ayarlari eksik veya pasif.",
    };
  }

  const checkout = await retrieveCheckoutForm(
    paymentReference,
    iyzicoConfig,
    paymentConversationId ?? undefined,
  );

  if (checkout.status !== "success" || checkout.paymentStatus !== "SUCCESS") {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[iyzico-refund] checkout verify failed", {
        orderId,
        checkoutStatus: checkout.status,
        paymentStatus: checkout.paymentStatus,
      });
    } else {
      console.warn("[iyzico-refund] checkout verify failed");
    }
    return {
      success: false as const,
      message:
        checkout.errorMessage ??
        "Iyzico odeme dogrulanamadi. Iade islemi guvenli sekilde baslatilamadi.",
    };
  }

  const verifiedPaidPrice = Number(checkout.paidPrice);
  if (Number.isFinite(verifiedPaidPrice) && amount > verifiedPaidPrice + 0.01) {
    return {
      success: false as const,
      message: `Iade tutarı (${amount} TL) ödenen tutardan (${verifiedPaidPrice} TL) fazla olamaz.`,
    };
  }

  if (!checkout.paymentTransactionId) {
    return {
      success: false as const,
      message:
        "Iyzico paymentTransactionId bulunamadi. Bu kayit icin iade baslatilamadi.",
    };
  }

  const refundConversationId = `refund-order-${orderId}-${Date.now()}`;
  const refund = await createRefund(
    {
      paymentTransactionId: checkout.paymentTransactionId,
      conversationId: refundConversationId,
      price: amount.toFixed(2),
    },
    iyzicoConfig,
  );

  if (refund.status !== "success") {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[iyzico-refund] refund failed", { orderId, status: refund.status });
    } else {
      console.warn("[iyzico-refund] refund failed");
    }
    return {
      success: false as const,
      message: refund.errorMessage ?? "Iyzico iade istegi basarisiz oldu.",
    };
  }

  return {
    success: true as const,
    refundReference:
      refund.paymentTransactionId ??
      refund.paymentId ??
      checkout.paymentTransactionId,
  };
}
