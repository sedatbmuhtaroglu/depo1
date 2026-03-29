type CancellationFinanceMeta = {
  operationType?: "CANCEL" | "REFUND";
  selectedPaymentMethod?: string | null;
  refundedAmount?: number | null;
  paymentSettled?: boolean | null;
  note?: string | null;
};

const META_PREFIX = "__META__";

export function buildCancellationCustomReason(input: {
  note?: string | null;
  operationType?: "CANCEL" | "REFUND";
  selectedPaymentMethod?: string | null;
  refundedAmount?: number | null;
  paymentSettled?: boolean | null;
}): string | null {
  const note = input.note?.trim() || null;
  const hasMeta =
    input.operationType != null ||
    input.selectedPaymentMethod != null ||
    input.refundedAmount != null ||
    input.paymentSettled != null;

  if (!hasMeta) return note;

  const payload: CancellationFinanceMeta = {
    note,
    operationType: input.operationType ?? undefined,
    selectedPaymentMethod: input.selectedPaymentMethod ?? null,
    refundedAmount:
      input.refundedAmount == null || Number.isNaN(input.refundedAmount)
        ? null
        : Number(input.refundedAmount),
    paymentSettled: input.paymentSettled == null ? null : Boolean(input.paymentSettled),
  };
  return `${META_PREFIX}${JSON.stringify(payload)}`;
}

export function parseCancellationCustomReason(raw?: string | null): {
  note: string | null;
  operationType: "CANCEL" | "REFUND" | null;
  selectedPaymentMethod: string | null;
  refundedAmount: number | null;
  paymentSettled: boolean | null;
} {
  if (!raw) {
    return {
      note: null,
      operationType: null,
      selectedPaymentMethod: null,
      refundedAmount: null,
      paymentSettled: null,
    };
  }

  if (!raw.startsWith(META_PREFIX)) {
    return {
      note: raw,
      operationType: null,
      selectedPaymentMethod: null,
      refundedAmount: null,
      paymentSettled: null,
    };
  }

  const payloadText = raw.slice(META_PREFIX.length);
  try {
    const payload = JSON.parse(payloadText) as CancellationFinanceMeta;
    const refundedAmount =
      payload.refundedAmount == null ? null : Number(payload.refundedAmount);
    return {
      note: payload.note?.trim() || null,
      operationType:
        payload.operationType === "REFUND" || payload.operationType === "CANCEL"
          ? payload.operationType
          : null,
      selectedPaymentMethod: payload.selectedPaymentMethod ?? null,
      refundedAmount:
        refundedAmount == null || Number.isNaN(refundedAmount)
          ? null
          : refundedAmount,
      paymentSettled:
        payload.paymentSettled == null ? null : Boolean(payload.paymentSettled),
    };
  } catch {
    return {
      note: raw,
      operationType: null,
      selectedPaymentMethod: null,
      refundedAmount: null,
      paymentSettled: null,
    };
  }
}

export function buildCancellationReasonLabel(input: {
  reasonCode: string;
  customReasonRaw?: string | null;
  reasonLabels?: Record<string, string>;
}): string {
  const parsed = parseCancellationCustomReason(input.customReasonRaw);
  const base = (input.reasonLabels?.[input.reasonCode] ?? input.reasonCode).trim();
  const note = parsed.note?.trim();
  return note ? `${base} (${note})` : base;
}
