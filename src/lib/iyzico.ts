import Iyzipay from "iyzipay";

/**
 * iyzico (iyzipay) payment gateway wrapper.
 * When config is passed, uses it; otherwise falls back to env.
 * Only import from API routes or server actions (not from server components).
 */

export const IYZICO_SANDBOX_URI = "https://sandbox-api.iyzipay.com";
export const IYZICO_PRODUCTION_URI = "https://api.iyzipay.com";

export type IyzicoConfig = {
  apiKey: string;
  secretKey: string;
  isSandbox: boolean;
};

function getIyzicoUri(config?: IyzicoConfig | null): string {
  if (config) {
    return config.isSandbox ? IYZICO_SANDBOX_URI : IYZICO_PRODUCTION_URI;
  }
  const uri = process.env.IYZIPAY_URI;
  if (uri) return uri.replace(/\/+$/, "");
  return process.env.NODE_ENV === "production" ? IYZICO_PRODUCTION_URI : IYZICO_SANDBOX_URI;
}

function getIyzipay(config?: IyzicoConfig | null) {
  const apiKey = config?.apiKey ?? process.env.IYZIPAY_API_KEY;
  const secretKey = config?.secretKey ?? process.env.IYZIPAY_SECRET_KEY;
  return new Iyzipay({
    uri: getIyzicoUri(config),
    apiKey,
    secretKey,
  });
}

export type IyzicoCheckoutInitializeParams = {
  conversationId: string;
  price: string;
  paidPrice: string;
  basketId: string;
  callbackUrl: string;
  buyer: {
    id: string;
    name: string;
    surname: string;
    email: string;
    identityNumber: string;
    gsmNumber: string;
    registrationAddress: string;
    city: string;
    country: string;
    zipCode: string;
  };
  shippingAddress: {
    contactName: string;
    city: string;
    country: string;
    address: string;
    zipCode: string;
  };
  billingAddress: {
    contactName: string;
    city: string;
    country: string;
    address: string;
    zipCode: string;
  };
  basketItems: Array<{
    id: string;
    name: string;
    category1: string;
    category2: string;
    itemType: string;
    price: string;
  }>;
};

export function createCheckoutFormInitialize(
  params: IyzicoCheckoutInitializeParams,
  config?: IyzicoConfig | null,
): Promise<{ status: string; token?: string; paymentPageUrl?: string; errorMessage?: string }> {
  return new Promise((resolve) => {
    const iyzipay = getIyzipay(config);

    const request = {
      locale: Iyzipay.LOCALE.TR,
      conversationId: params.conversationId,
      price: params.price,
      paidPrice: params.paidPrice,
      currency: Iyzipay.CURRENCY.TRY,
      basketId: params.basketId,
      paymentGroup: Iyzipay.PAYMENT_GROUP.PRODUCT,
      callbackUrl: params.callbackUrl,
      enabledInstallments: [1, 2, 3, 6, 9, 12],
      buyer: {
        ...params.buyer,
        registrationDate: "2013-04-21 15:12:09",
        lastLoginDate: "2015-10-05 12:43:35",
        ip: "85.34.78.112",
      },
      shippingAddress: params.shippingAddress,
      billingAddress: params.billingAddress,
      basketItems: params.basketItems,
    };

    iyzipay.checkoutFormInitialize.create(request, (err: unknown, result: Record<string, unknown>) => {
      if (err) {
        resolve({
          status: "failure",
          errorMessage: err instanceof Error ? err.message : String(err),
        });
        return;
      }
      resolve({
        status: (result.status as string) ?? "failure",
        token: result.token as string | undefined,
        paymentPageUrl: result.paymentPageUrl as string | undefined,
        errorMessage: result.errorMessage as string | undefined,
      });
    });
  });
}

export function retrieveCheckoutForm(
  token: string,
  config?: IyzicoConfig | null,
  conversationId?: string,
): Promise<{
  status: string;
  paymentStatus?: string;
  paymentId?: string;
  paymentTransactionId?: string;
  conversationId?: string;
  paidPrice?: string;
  errorMessage?: string;
}> {
  return new Promise((resolve) => {
    const iyzipay = getIyzipay(config);

    iyzipay.checkoutForm.retrieve(
      {
        locale: Iyzipay.LOCALE.TR,
        conversationId: conversationId ?? `retrieve-${Date.now()}`,
        token,
      },
      (err: unknown, result: Record<string, unknown>) => {
        if (err) {
          resolve({
            status: "failure",
            errorMessage: err instanceof Error ? err.message : String(err),
          });
          return;
        }
        resolve({
          status: (result.status as string) ?? "failure",
          paymentStatus: result.paymentStatus as string | undefined,
          paymentId: result.paymentId as string | undefined,
          paymentTransactionId:
            Array.isArray(result.paymentItems) && result.paymentItems.length > 0
              ? ((result.paymentItems[0] as Record<string, unknown>)
                  .paymentTransactionId as string | undefined)
              : Array.isArray(result.itemTransactions) && result.itemTransactions.length > 0
                ? ((result.itemTransactions[0] as Record<string, unknown>)
                    .paymentTransactionId as string | undefined)
                : undefined,
          conversationId: result.conversationId as string | undefined,
          paidPrice: result.paidPrice as string | undefined,
          errorMessage: result.errorMessage as string | undefined,
        });
      },
    );
  });
}

export function createRefund(params: {
  paymentTransactionId: string;
  price: string;
  conversationId: string;
  ip?: string;
}, config?: IyzicoConfig | null): Promise<{
  status: string;
  paymentId?: string;
  paymentTransactionId?: string;
  conversationId?: string;
  errorMessage?: string;
}> {
  return new Promise((resolve) => {
    const iyzipay = getIyzipay(config);
    iyzipay.refund.create(
      {
        locale: Iyzipay.LOCALE.TR,
        conversationId: params.conversationId,
        paymentTransactionId: params.paymentTransactionId,
        price: params.price,
        currency: Iyzipay.CURRENCY.TRY,
        ip: params.ip ?? "127.0.0.1",
      },
      (err: unknown, result: Record<string, unknown>) => {
        if (err) {
          resolve({
            status: "failure",
            errorMessage: err instanceof Error ? err.message : String(err),
          });
          return;
        }
        resolve({
          status: (result.status as string) ?? "failure",
          paymentId: result.paymentId as string | undefined,
          paymentTransactionId: result.paymentTransactionId as string | undefined,
          conversationId: result.conversationId as string | undefined,
          errorMessage: result.errorMessage as string | undefined,
        });
      },
    );
  });
}

export function cancelPayment(params: {
  paymentId: string;
  conversationId: string;
  ip?: string;
}, config?: IyzicoConfig | null): Promise<{
  status: string;
  paymentId?: string;
  conversationId?: string;
  errorMessage?: string;
}> {
  return new Promise((resolve) => {
    const iyzipay = getIyzipay(config);
    iyzipay.cancel.create(
      {
        locale: Iyzipay.LOCALE.TR,
        conversationId: params.conversationId,
        paymentId: params.paymentId,
        ip: params.ip ?? "127.0.0.1",
      },
      (err: unknown, result: Record<string, unknown>) => {
        if (err) {
          resolve({
            status: "failure",
            errorMessage: err instanceof Error ? err.message : String(err),
          });
          return;
        }
        resolve({
          status: (result.status as string) ?? "failure",
          paymentId: result.paymentId as string | undefined,
          conversationId: result.conversationId as string | undefined,
          errorMessage: result.errorMessage as string | undefined,
        });
      },
    );
  });
}
