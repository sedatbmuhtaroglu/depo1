import { notFound } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { prisma } from "@/lib/prisma";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import PrintControls from "./print-controls";

function getBaseUrlFromHeaders(h: { get(name: string): string | null }): string {
  const forwardedHost = h.get("x-forwarded-host");
  const host = forwardedHost || h.get("host");
  const forwardedProto = h.get("x-forwarded-proto");

  if (host) {
    const scheme = forwardedProto === "http" ? "http" : "https";
    return `${scheme}://${host}`.replace(/\/+$/, "");
  }

  const envBase =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.VERCEL_URL;

  if (envBase) {
    const normalized = envBase.startsWith("http")
      ? envBase
      : `https://${envBase}`;
    return normalized.replace(/\/+$/, "");
  }

  return "http://localhost:3000";
}

export const dynamic = "force-dynamic";

export default async function TableQrPage({
  params,
  searchParams,
}: {
  params: Promise<{ tableId: string }>;
  searchParams: Promise<{ autoprint?: string }>;
}) {
  const [{ tenantId }, { tableId }, query] = await Promise.all([
    getCurrentTenantOrThrow(),
    params,
    searchParams,
  ]);

  const tableIdNum = Number.parseInt(tableId, 10);
  if (Number.isNaN(tableIdNum)) {
    notFound();
  }

  const table = await prisma.table.findFirst({
    where: {
      id: tableIdNum,
      restaurant: { tenantId },
    },
    select: {
      id: true,
      tableNo: true,
      publicCode: true,
      restaurant: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!table) {
    notFound();
  }

  const h = await headers();
  const baseUrl = getBaseUrlFromHeaders(h);
  const entryUrl = `${baseUrl}/m/${table.publicCode}`;
  const qrDataUrl = await QRCode.toDataURL(entryUrl, {
    width: 900,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  const autoPrint = query.autoprint === "1";

  return (
    <div className="qr-print-shell mx-auto max-w-3xl p-4 sm:p-6">
      <PrintControls backHref="/restaurant/tables" autoPrint={autoPrint} />

      <section className="qr-print-card rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
        <div className="mb-4 text-center">
          <h2 className="text-2xl font-bold text-neutral-900">
            {table.restaurant.name}
          </h2>
          <p className="mt-1 text-base font-medium text-neutral-600">
            Masa {table.tableNo}
          </p>
        </div>

        <div className="mx-auto w-full max-w-[480px] rounded-xl border border-neutral-200 bg-white p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrDataUrl}
            alt={`Masa ${table.tableNo} QR`}
            className="mx-auto h-auto w-full"
          />
        </div>

        <p className="mt-4 break-all text-center text-sm text-neutral-500 print:text-black">
          {entryUrl}
        </p>
      </section>

      <style>{`
        @media print {
          .qr-print-shell {
            max-width: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .qr-print-card {
            box-shadow: none !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
