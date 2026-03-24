import type { PaymentMethod, PaymentGatewayProvider } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getIyzicoEnabledForTenant } from "@/lib/iyzico-config";

export type CustomerPaymentMethod =
  | "CASH"
  | "CREDIT_CARD"
  | "IYZICO"
  | "PAY_LATER";

export type TenantCustomerPaymentMethods = {
  cash: boolean;
  creditCard: boolean;
  iyzico: boolean;
  hasAny: boolean;
};

export function toDbPaymentMethod(
  method: CustomerPaymentMethod,
): PaymentMethod | null {
  if (method === "PAY_LATER") return null;
  if (method === "IYZICO") return "CREDIT_CARD";
  return method;
}

export function labelCustomerPaymentMethod(
  method: CustomerPaymentMethod,
): string {
  if (method === "PAY_LATER") return "Sonra Ode";
  if (method === "IYZICO") return "Iyzico ile Ode";
  if (method === "CREDIT_CARD") return "Kredi Karti";
  return "Nakit";
}

export function labelDbPaymentMethod(
  method: PaymentMethod | null | undefined,
  paymentProvider?: PaymentGatewayProvider | null,
): string {
  if (!method) return paymentProvider === "IYZICO" ? "Iyzico ile Ode" : "Sonra Ode";
  if (method === "CASH") return "Nakit";
  if (method === "CREDIT_CARD") {
    return paymentProvider === "IYZICO" ? "Iyzico ile Ode" : "Kredi Karti";
  }
  if (method === "SODEXO") return "Sodexo";
  if (method === "MULTINET") return "Multinet";
  if (method === "TICKET") return "Ticket";
  if (method === "METROPOL") return "Metropol";
  return method;
}

export function isCustomerPaymentMethodEnabled(
  selectedMethod: CustomerPaymentMethod,
  methods: TenantCustomerPaymentMethods,
): boolean {
  if (selectedMethod === "PAY_LATER") return true;
  if (selectedMethod === "CASH") return methods.cash;
  if (selectedMethod === "CREDIT_CARD") return methods.creditCard;
  return methods.iyzico;
}

export async function getTenantCustomerPaymentMethods(
  tenantId: number,
): Promise<TenantCustomerPaymentMethods> {
  const [methods, iyzico] = await Promise.all([
    prisma.tenantPaymentMethod.findMany({
      where: {
        tenantId,
        method: { in: ["CASH", "CREDIT_CARD"] },
      },
      select: {
        method: true,
        isActive: true,
      },
    }),
    getIyzicoEnabledForTenant(tenantId),
  ]);

  const cash = methods.find((m) => m.method === "CASH")?.isActive ?? false;
  const creditCard =
    methods.find((m) => m.method === "CREDIT_CARD")?.isActive ?? false;

  return {
    cash,
    creditCard,
    iyzico,
    hasAny: cash || creditCard || iyzico,
  };
}
