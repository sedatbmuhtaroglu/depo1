'use server';

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { requireCashierWaiterOrManagerSession } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { writeAuditLog } from "@/lib/audit-log";
import { logServerError } from "@/lib/server-error-log";

type BillRequestStatusValue =
  | "PENDING"
  | "ACKNOWLEDGED"
  | "SETTLED"
  | "CANCELED";

export async function updateBillRequestStatus(
  billRequestId: number,
  status: BillRequestStatusValue,
) {
  try {
    const { username, tenantId, staffId } = await requireCashierWaiterOrManagerSession("billrequest.view");
    const { tenantId: ctxTenantId } = await getCurrentTenantOrThrow();
    if (ctxTenantId !== tenantId) {
      return { success: false, message: "Yetkisiz." };
    }

    const bill = await prisma.billRequest.findFirst({
      where: {
        id: billRequestId,
        tenantId,
      },
      include: {
        table: true,
      },
    });

    if (!bill) {
      return {
        success: false,
        message: "Bu hesap istegine erisim yetkiniz yok veya kayit bulunamadi.",
      };
    }

    if (bill.status === "SETTLED") {
      return {
        success: true,
        message: "Bu hesap istegi zaten odendi ve kapatildi.",
      };
    }

    if (bill.status === "CANCELED") {
      return {
        success: true,
        message: "Bu hesap istegi zaten vazgecildi olarak kapatilmis.",
      };
    }

    if (status === "SETTLED") {
      return {
        success: false,
        message:
          "Hesap istegi bu ekrandan odendi yapilamaz. Lutfen Odeme Al / Kapat akisini kullanin.",
      };
    }

    if (bill.status === status) {
      return {
        success: true,
        message:
          status === "ACKNOWLEDGED"
            ? "Hesap istegi zaten alindi olarak isaretlenmis."
            : "Hesap istegi zaten beklemede.",
      };
    }

    if (bill.status === "PENDING" && status === "PENDING") {
      return {
        success: true,
        message: "Hesap istegi zaten beklemede.",
      };
    }

    if (bill.status === "ACKNOWLEDGED" && status === "PENDING") {
      return {
        success: false,
        message: "Alinmis bir hesap istegi tekrar beklemede durumuna alinamaz.",
      };
    }

    const now = new Date();
    if (status === "CANCELED") {
      await prisma.billRequest.update({
        where: { id: bill.id },
        data: {
          status: "CANCELED",
        },
      });
    } else if (status === "ACKNOWLEDGED") {
      const updateData: {
        status: BillRequestStatusValue;
        acknowledgedAt?: Date;
        acknowledgedByStaffId?: number | null;
      } = { status };
      if (!bill.acknowledgedAt) {
        updateData.acknowledgedAt = now;
        updateData.acknowledgedByStaffId = staffId ?? null;
      }
      await prisma.billRequest.update({
        where: { id: bill.id },
        data: updateData,
      });
    } else {
      await prisma.billRequest.update({
        where: { id: bill.id },
        data: { status },
      });
    }

    await writeAuditLog({
      tenantId,
      actor: { type: "admin", id: username },
      actionType: "BILL_REQUEST_STATUS",
      entityType: "BillRequest",
      entityId: String(billRequestId),
      description:
        status === "CANCELED" ? "Hesap vazgecildi" : "Hesap istegi alindi",
    });

    revalidatePath("/waiter");
    revalidatePath("/restaurant");

    return {
      success: true,
      message:
        status === "ACKNOWLEDGED"
          ? "Hesap istegi alindi olarak isaretlendi."
          : "Hesap istegi vazgecildi olarak kapatildi. Borc aynen korunur.",
    };
  } catch (error) {
    logServerError("update-bill-request-status", error);
    return {
      success: false,
      message: "Hesap istegi guncellenirken bir hata olustu.",
    };
  }
}


