'use server'

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getPrivilegedSessionForTenant } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { writeAuditLog } from "@/lib/audit-log";
import {
  isOrderAwaitingOnlinePayment,
  isOrderPaidViaIyzico,
} from "@/lib/order-payment-visibility";
import { refundPaidIyzicoOrder } from "@/lib/iyzico-order-refund";
import { logServerError } from "@/lib/server-error-log";
import { assertPrivilegedServerActionOrigin } from "@/lib/server-action-guard";
import {
  getOrderRefundRuntimeErrorMessage,
  isOrderRefundRuntimeReady,
} from "@/lib/order-refund-runtime";

type OrderStatusValue =
  | "PENDING_WAITER_APPROVAL"
  | "PENDING"
  | "PREPARING"
  | "COMPLETED"
  | "REJECTED";

type TransitionRule = `${OrderStatusValue}->${OrderStatusValue}`;
type RoleValue = "MANAGER" | "CASHIER" | "WAITER" | "KITCHEN";
type UpdateOrderStatusErrorCode =
  | "ROLE_NOT_ALLOWED"
  | "UNAUTHORIZED_STATUS_TRANSITION"
  | "INVALID_STATUS_FLOW";

type UpdateOrderStatusResult =
  | { success: true }
  | { success: false; message: string; code?: UpdateOrderStatusErrorCode };

const VALID_STATUS_FLOW = new Set<TransitionRule>([
  "PENDING_WAITER_APPROVAL->PENDING",
  "PENDING_WAITER_APPROVAL->REJECTED",
  "PENDING->PREPARING",
  "PENDING->REJECTED",
  "PREPARING->COMPLETED",
  "PREPARING->REJECTED",
]);

const ROLE_ALLOWED_TRANSITIONS: Record<RoleValue, Set<TransitionRule>> = {
  CASHIER: new Set<TransitionRule>([]),
  WAITER: new Set<TransitionRule>([
    "PENDING_WAITER_APPROVAL->PENDING",
    "PENDING_WAITER_APPROVAL->REJECTED",
  ]),
  KITCHEN: new Set<TransitionRule>([
    "PENDING->PREPARING",
    "PREPARING->COMPLETED",
  ]),
  // Manager override remains, but only across valid operational flow transitions.
  MANAGER: new Set<TransitionRule>(VALID_STATUS_FLOW),
};

export async function updateOrderStatus(
  orderId: number,
  status: OrderStatusValue,
): Promise<UpdateOrderStatusResult> {
  try {
    await assertPrivilegedServerActionOrigin();
    const { tenantId } = await getCurrentTenantOrThrow();
    const session = await getPrivilegedSessionForTenant(tenantId);
    if (!session) {
      return {
        success: false,
        code: "ROLE_NOT_ALLOWED",
        message: "Bu islem icin yetkili oturum bulunamadi.",
      };
    }

    const order = await prisma.order.findFirst({
      where: {
        id: orderId,
        table: { restaurant: { tenantId } },
      },
      select: {
        id: true,
        status: true,
        preparingStartedAt: true,
        totalPrice: true,
        requestedPaymentMethod: true,
        paymentStatus: true,
        paymentProvider: true,
        paymentReference: true,
        paymentConversationId: true,
      },
    });
    if (!order) {
      return { success: false, message: "Siparis bulunamadi." };
    }

    if (order.status === status) {
      return {
        success: false,
        code: "INVALID_STATUS_FLOW",
        message: "Siparis zaten bu durumda.",
      };
    }

    const transition = `${order.status}->${status}` as TransitionRule;
    if (!VALID_STATUS_FLOW.has(transition)) {
      return {
        success: false,
        code: "INVALID_STATUS_FLOW",
        message: `Gecersiz durum gecisi: ${order.status} -> ${status}.`,
      };
    }

    const roleTransitions = ROLE_ALLOWED_TRANSITIONS[session.role];
    if (!roleTransitions) {
      return {
        success: false,
        code: "ROLE_NOT_ALLOWED",
        message: "Rolunuz bu islem icin uygun degil.",
      };
    }

    if (!roleTransitions.has(transition)) {
      return {
        success: false,
        code: "UNAUTHORIZED_STATUS_TRANSITION",
        message: "Rolunuz bu siparis durum gecisini yapamaz.",
      };
    }

    if (isOrderAwaitingOnlinePayment(order)) {
      return {
        success: false,
        message: "Online odeme tamamlanmadan siparis isleme alinamaz.",
      };
    }

    let refundReference: string | null = null;
    if (status === "REJECTED" && isOrderPaidViaIyzico(order)) {
      if (!isOrderRefundRuntimeReady()) {
        return {
          success: false,
          message: getOrderRefundRuntimeErrorMessage(),
        };
      }

      await prisma.order.update({
        where: { id: order.id },
        data: {
          refundStatus: "REFUND_PENDING",
          refundFailureReason: null,
        },
      });

      const refundResult = await refundPaidIyzicoOrder({
        tenantId,
        orderId: order.id,
        amount: Number(order.totalPrice),
        paymentReference: order.paymentReference ?? null,
        paymentConversationId: order.paymentConversationId ?? null,
      });

      if (!refundResult.success) {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            refundStatus: "REFUND_FAILED",
            refundFailureReason: refundResult.message.slice(0, 512),
          },
        });

        return {
          success: false,
          message: `Iyzico iadesi basarisiz: ${refundResult.message}`,
        };
      }

      refundReference = refundResult.refundReference ?? null;
    }

    const now = new Date();
    await prisma.order.update({
      where: { id: orderId },
      data: {
        status,
        ...(status === "PREPARING" &&
          order.preparingStartedAt == null && { preparingStartedAt: now }),
        ...(status === "COMPLETED" && { readyAt: now }),
        ...(status === "REJECTED" &&
          isOrderPaidViaIyzico(order) && {
            refundStatus: "REFUNDED",
            refundedAt: now,
            refundReference,
            refundFailureReason: null,
          }),
      },
    });

    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: session.username },
      actionType: "ORDER_STATUS",
      entityType: "Order",
      entityId: String(orderId),
      description:
        status === "REJECTED" && refundReference
          ? `REJECTED + IYZICO_REFUND (${refundReference})`
          : status,
    });

    revalidatePath("/admin/orders");
    revalidatePath("/restaurant");
    revalidatePath("/kitchen");
    revalidatePath("/waiter");
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    logServerError("update-order-status", error);
    return { success: false, message: "Siparis guncellenemedi." };
  }
}

