import { prismaModelHasField } from "@/lib/prisma";

const REQUIRED_ORDER_REFUND_FIELDS = [
  "refundStatus",
  "refundedAt",
  "refundReference",
  "refundFailureReason",
] as const;

export function getMissingOrderRefundFields(): string[] {
  return REQUIRED_ORDER_REFUND_FIELDS.filter(
    (fieldName) => !prismaModelHasField("Order", fieldName),
  );
}

export function isOrderRefundRuntimeReady(): boolean {
  return getMissingOrderRefundFields().length === 0;
}

export function getOrderRefundRuntimeErrorMessage(): string {
  const missing = getMissingOrderRefundFields();
  if (missing.length === 0) {
    return "Refund runtime hazır.";
  }

  return `Refund alanlari aktif degil (${missing.join(", ")}). Lutfen migration + prisma generate + server restart yapin.`;
}

