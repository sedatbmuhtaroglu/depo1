import React from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { CheckCircle2, ChevronLeft, XCircle, AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getValidTableSession } from "@/lib/table-session";
import { verifyOrderSuccessAccessProof } from "@/lib/order-success-access";

type PaymentState = "paid" | "failed" | "error" | "pending";

function resolvePaymentState(raw?: string): PaymentState {
  if (raw === "paid") return "paid";
  if (raw === "failed") return "failed";
  if (raw === "error") return "error";
  return "pending";
}

function paymentStateUi(state: PaymentState): {
  title: string;
  description: string;
  badgeClass: string;
  badgeLabel: string;
  icon: React.ReactNode;
} {
  if (state === "paid") {
    return {
      title: "Odeme Basarili",
      description: "Iyzico odemeniz alindi. Siparisiniz isleme alindi.",
      badgeClass: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30",
      badgeLabel: "Odendi",
      icon: <CheckCircle2 className="h-8 w-8 text-emerald-500" />,
    };
  }
  if (state === "failed") {
    return {
      title: "Odeme Basarisiz",
      description:
        "Iyzico odemesi tamamlanamadi. Siparisiniz icin odemeyi tekrar deneyin veya garsona basvurun.",
      badgeClass: "bg-rose-500/10 text-rose-400 border border-rose-500/30",
      badgeLabel: "Basarisiz",
      icon: <XCircle className="h-8 w-8 text-rose-500" />,
    };
  }
  if (state === "error") {
    return {
      title: "Odeme Dogrulanamadi",
      description:
        "Odeme geri bildirimi alinirken beklenmeyen bir hata olustu. Lutfen restoran personeline bilgi verin.",
      badgeClass: "bg-amber-500/10 text-amber-400 border border-amber-500/30",
      badgeLabel: "Dogrulanamadi",
      icon: <AlertTriangle className="h-8 w-8 text-amber-500" />,
    };
  }
  return {
    title: "Siparisiniz Alindi",
    description:
      "Siparisiniz garson onayina gonderildi. Onay sonrasi hazirlanmaya baslanacaktir.",
    badgeClass: "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20",
    badgeLabel: "Bekliyor",
    icon: <CheckCircle2 className="h-8 w-8 text-green-500" />,
  };
}

function NotFoundState() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-900 p-4">
      <div className="text-center text-white">
        <h1 className="mb-2 text-2xl font-bold">Siparis Bulunamadi</h1>
        <p className="mb-6 text-neutral-400">Aradiginiz siparise ulasilamadi.</p>
        <Link
          href="/"
          className="inline-flex items-center text-primary-500 transition-colors hover:text-primary-400"
        >
          <ChevronLeft className="mr-1 h-4 w-4" />
          Anasayfaya Don
        </Link>
      </div>
    </div>
  );
}

export default async function OrderSuccessPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams?: Promise<{ payment?: string; paymentRef?: string; accessProof?: string }>;
}) {
  const { orderId } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const paymentState = resolvePaymentState(resolvedSearchParams.payment);
  const paymentUi = paymentStateUi(paymentState);

  const parsedOrderId = Number(orderId);
  if (!Number.isInteger(parsedOrderId) || parsedOrderId < 1) {
    return <NotFoundState />;
  }

  const order = await prisma.order.findUnique({
    where: { id: parsedOrderId },
    include: {
      table: {
        include: {
          restaurant: {
            include: {
              tenant: {
                select: {
                  slug: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!order) {
    return <NotFoundState />;
  }

  const paymentRef = resolvedSearchParams.paymentRef ?? null;
  const accessProof = resolvedSearchParams.accessProof ?? null;

  // Access policy:
  // 1) Primary: table_session (tenant + table bound).
  // 2) Payment callback fallback: paymentRef + signed short-lived access proof.
  const tableSession = await getValidTableSession();
  const canAccessViaTableSession =
    Boolean(tableSession) &&
    tableSession!.tableId === order.table.id &&
    tableSession!.tenantId === order.table.restaurant.tenantId;

  const requestHeaders = await headers();
  const requestTenantSlug = requestHeaders.get("x-tenant-slug")?.trim().toLowerCase() ?? null;
  const orderTenantSlug = order.table.restaurant.tenant?.slug?.trim().toLowerCase() ?? null;
  const tenantHeaderMatchesOrder =
    requestTenantSlug == null || requestTenantSlug.length === 0
      ? true
      : requestTenantSlug === orderTenantSlug;

  const canAccessViaPaymentRef =
    typeof paymentRef === "string" &&
    paymentRef.length > 0 &&
    paymentRef === order.paymentReference &&
    paymentState === "paid" &&
    order.paymentStatus === "PAID" &&
    tenantHeaderMatchesOrder &&
    verifyOrderSuccessAccessProof({
      proof: typeof accessProof === "string" ? accessProof : null,
      orderId: order.id,
      tenantId: order.table.restaurant.tenantId,
      paymentReference: order.paymentReference,
    });

  if (!canAccessViaTableSession && !canAccessViaPaymentRef) {
    if (process.env.NODE_ENV !== "production" && paymentState === "paid") {
      console.warn("OrderSuccessPage access denied (dev: check table session vs paymentRef)");
    }
    return <NotFoundState />;
  }

  const tenantSlug = order.table.restaurant.tenant?.slug ?? null;
  const menuLink = tenantSlug
    ? `/menu/${encodeURIComponent(tenantSlug)}/${order.table.id}`
    : `/${order.table.id}`;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-900 p-4">
      <div className="w-full max-w-md rounded-2xl border border-neutral-700 bg-neutral-800 p-8 text-center shadow-xl">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-neutral-900">
          {paymentUi.icon}
        </div>

        <h1 className="mb-2 text-2xl font-bold text-white">{paymentUi.title}</h1>
        <p className="mb-8 text-neutral-300">{paymentUi.description}</p>

        <div className="mb-8 rounded-xl border border-neutral-700 bg-neutral-900 p-4 text-left">
          <div className="mb-3 flex items-center justify-between border-b border-neutral-800 pb-3">
            <span className="text-neutral-400">Siparis No</span>
            <span className="font-medium text-white">#{order.id}</span>
          </div>
          <div className="mb-3 flex items-center justify-between border-b border-neutral-800 pb-3">
            <span className="text-neutral-400">Masa</span>
            <span className="font-medium text-white">{order.table.tableNo}</span>
          </div>
          <div className="mb-3 flex items-center justify-between border-b border-neutral-800 pb-3">
            <span className="text-neutral-400">Siparis Durumu</span>
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                order.status === "PENDING_WAITER_APPROVAL"
                  ? "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20"
                  : "bg-neutral-700 text-neutral-100"
              }`}
            >
              {order.status === "PENDING_WAITER_APPROVAL"
                ? "Garson Onayi Bekliyor"
                : order.status}
            </span>
          </div>
          <div className="mb-3 flex items-center justify-between border-b border-neutral-800 pb-3">
            <span className="text-neutral-400">Odeme Durumu</span>
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${paymentUi.badgeClass}`}>
              {paymentUi.badgeLabel}
            </span>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-neutral-400">Toplam Tutar</span>
            <span className="text-xl font-bold text-white">{order.totalPrice.toString()} TL</span>
          </div>
        </div>

        <Link
          href={menuLink}
          className="inline-flex w-full items-center justify-center rounded-xl border border-transparent bg-white px-4 py-3 text-sm font-medium text-black transition-colors hover:bg-neutral-200 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 focus:ring-offset-neutral-900"
        >
          Menuye Don
        </Link>
      </div>
    </div>
  );
}
