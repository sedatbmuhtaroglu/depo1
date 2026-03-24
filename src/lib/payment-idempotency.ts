import { PaymentGatewayProvider, PaymentMethod, Prisma } from "@prisma/client";

type GatewayPaymentIdentity = {
  gatewayProvider: PaymentGatewayProvider;
  gatewayPaymentId: string;
};

type GatewayIdentityResolution =
  | { ok: true; identity: GatewayPaymentIdentity | null }
  | { ok: false; message: string };

type ExistingGatewayPayment = {
  id: number;
  billRequestId: number | null;
};

export type CreateGatewayPaymentIdempotentResult =
  | { status: "created"; paymentId: number }
  | { status: "already_exists_same_bill"; paymentId: number }
  | { status: "conflict"; existingPaymentId: number; existingBillRequestId: number | null };

function normalizeGatewayPaymentId(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  if (!normalized) return null;
  return normalized;
}

export function resolveGatewayPaymentIdentity(input: {
  gatewayProvider?: PaymentGatewayProvider | null;
  gatewayPaymentId?: string | null;
}): GatewayIdentityResolution {
  const provider = input.gatewayProvider ?? null;
  const paymentId = normalizeGatewayPaymentId(input.gatewayPaymentId ?? null);

  if (!provider && !paymentId) {
    return { ok: true, identity: null };
  }

  if (!provider || !paymentId) {
    return {
      ok: false,
      message: "Odeme saglayici bilgisi eksik veya gecersiz.",
    };
  }

  return {
    ok: true,
    identity: {
      gatewayProvider: provider,
      gatewayPaymentId: paymentId,
    },
  };
}

export function isDuplicatePaymentError(error: unknown): boolean {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  if (Array.isArray(target)) {
    return (
      target.includes("tenantId") &&
      target.includes("gatewayProvider") &&
      target.includes("gatewayPaymentId")
    );
  }

  if (typeof target === "string") {
    return (
      target.includes("tenantId") &&
      target.includes("gatewayProvider") &&
      target.includes("gatewayPaymentId")
    );
  }

  return true;
}

async function findExistingGatewayPayment(params: {
  tx: Prisma.TransactionClient;
  tenantId: number;
  identity: GatewayPaymentIdentity;
}): Promise<ExistingGatewayPayment | null> {
  const { tx, tenantId, identity } = params;

  return tx.payment.findUnique({
    where: {
      tenantId_gatewayProvider_gatewayPaymentId: {
        tenantId,
        gatewayProvider: identity.gatewayProvider,
        gatewayPaymentId: identity.gatewayPaymentId,
      },
    },
    select: {
      id: true,
      billRequestId: true,
    },
  });
}

export async function createGatewayPaymentIdempotent(params: {
  tx: Prisma.TransactionClient;
  tenantId: number;
  billRequestId: number;
  tableId: number;
  amount: number;
  method: PaymentMethod;
  note?: string | null;
  identity: GatewayPaymentIdentity;
}): Promise<CreateGatewayPaymentIdempotentResult> {
  const { tx, tenantId, billRequestId, tableId, amount, method, note, identity } = params;

  const existingBeforeCreate = await findExistingGatewayPayment({
    tx,
    tenantId,
    identity,
  });

  if (existingBeforeCreate) {
    if (existingBeforeCreate.billRequestId === billRequestId) {
      return {
        status: "already_exists_same_bill",
        paymentId: existingBeforeCreate.id,
      };
    }

    return {
      status: "conflict",
      existingPaymentId: existingBeforeCreate.id,
      existingBillRequestId: existingBeforeCreate.billRequestId,
    };
  }

  try {
    const created = await tx.payment.create({
      data: {
        tenantId,
        tableId,
        billRequestId,
        amount,
        method,
        note: note ?? undefined,
        gatewayProvider: identity.gatewayProvider,
        gatewayPaymentId: identity.gatewayPaymentId,
      },
      select: { id: true },
    });

    return {
      status: "created",
      paymentId: created.id,
    };
  } catch (error) {
    if (!isDuplicatePaymentError(error)) {
      throw error;
    }

    const existingAfterConflict = await findExistingGatewayPayment({
      tx,
      tenantId,
      identity,
    });

    if (!existingAfterConflict) {
      throw error;
    }

    if (existingAfterConflict.billRequestId === billRequestId) {
      return {
        status: "already_exists_same_bill",
        paymentId: existingAfterConflict.id,
      };
    }

    return {
      status: "conflict",
      existingPaymentId: existingAfterConflict.id,
      existingBillRequestId: existingAfterConflict.billRequestId,
    };
  }
}
