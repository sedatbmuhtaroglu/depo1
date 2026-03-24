import { createCheckoutFormInitialize } from "@/lib/iyzico";
import { getIyzicoConfigForTenant } from "@/lib/iyzico-config";

type InitializeOrderCheckoutParams = {
  tenantId: number;
  orderId: number;
  tableNo: number;
  totalAmount: number;
  callbackBaseUrl?: string | null;
  tenantSlug?: string | null;
};

type InitializeOrderCheckoutResult =
  | {
      success: true;
      paymentPageUrl: string;
      paymentToken: string;
      conversationId: string;
    }
  | {
      success: false;
      message: string;
    };

function sanitizeBaseUrl(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(normalized)) return null;
  return normalized;
}

function resolveCallbackUrl(baseUrl: string | null): string | null {
  if (!baseUrl) return null;
  return `${baseUrl}/api/payment/iyzico/order-callback`;
}

export async function initializeIyzicoCheckoutForOrder(
  params: InitializeOrderCheckoutParams,
): Promise<InitializeOrderCheckoutResult> {
  const { tenantId, orderId, tableNo, totalAmount, callbackBaseUrl, tenantSlug } = params;

  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    return { success: false, message: "Odeme tutari gecersiz." };
  }

  const iyzicoConfig = await getIyzicoConfigForTenant(tenantId);
  if (!iyzicoConfig) {
    return {
      success: false,
      message:
        "Iyzico odeme ayarlari eksik veya pasif. Lutfen restoran yöneticisine basvurun.",
    };
  }

  const callbackUrl = resolveCallbackUrl(sanitizeBaseUrl(callbackBaseUrl));
  if (!callbackUrl) {
    return {
      success: false,
      message:
        "Odeme callback adresi oluşturulamadi. Lutfen sistem yöneticisine basvurun.",
    };
  }
  const callbackParams = new URLSearchParams();
  callbackParams.set("orderId", String(orderId));
  if (tenantSlug) {
    callbackParams.set("tenant", tenantSlug);
  }
  const callbackUrlWithParams = `${callbackUrl}?${callbackParams.toString()}`;

  const priceStr = totalAmount.toFixed(2);
  const conversationId = `order-${orderId}-${Date.now()}`;
  const basketId = `ORDER-${orderId}`;

  const checkout = await createCheckoutFormInitialize(
    {
      conversationId,
      price: priceStr,
      paidPrice: priceStr,
      basketId,
      callbackUrl: callbackUrlWithParams,
      buyer: {
        id: `ORDER_${orderId}`,
        name: "Müşteri",
        surname: `Masa${tableNo}`,
        email: `order-${orderId}-table-${tableNo}@example.com`,
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
          id: `ORDER_ITEM_${orderId}`,
          name: `Sipariş #${orderId}`,
          category1: "Restoran",
          category2: "Sipariş",
          itemType: "VIRTUAL",
          price: priceStr,
        },
      ],
    },
    iyzicoConfig,
  );

  if (checkout.status !== "success") {
    return {
      success: false,
      message: checkout.errorMessage ?? "Iyzico odeme sayfasi oluşturulamadi.",
    };
  }

  if (!checkout.token) {
    return {
      success: false,
      message: "Iyzico odeme sayfasi bilgisi alinamadi.",
    };
  }

  const paymentPageUrl =
    checkout.paymentPageUrl ??
    (iyzicoConfig.isSandbox
      ? `https://sandbox-merchant.iyzipay.com/tr/odeme/form?token=${checkout.token}`
      : `https://merchant.iyzipay.com/tr/odeme/form?token=${checkout.token}`);

  return {
    success: true,
    paymentPageUrl,
    paymentToken: checkout.token,
    conversationId,
  };
}

