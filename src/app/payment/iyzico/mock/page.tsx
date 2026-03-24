import Link from "next/link";

type IyzicoMockPageProps = {
  searchParams?: Promise<{
    token?: string;
    status?: string;
  }>;
};

export default async function IyzicoMockPage({
  searchParams,
}: IyzicoMockPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const token = resolvedSearchParams.token;
  const status = resolvedSearchParams.status;

  if (!token) {
    return (
      <main className="mx-auto mt-10 max-w-lg rounded-2xl border border-neutral-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-neutral-900">IyziCo Mock Odeme</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Gecersiz token. Lutfen menu ekranindan odeme akisini tekrar baslatin.
        </p>
      </main>
    );
  }

  const callbackUrl = `/api/payment/iyzico/callback?token=${encodeURIComponent(token)}`;

  return (
    <main className="mx-auto mt-10 max-w-lg rounded-2xl border border-neutral-200 bg-white p-6">
      <h1 className="text-lg font-semibold text-neutral-900">IyziCo Mock Odeme</h1>
      {status === "success" ? (
        <p className="mt-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
          Odeme basariyla tamamlandi.
        </p>
      ) : status === "failed" ? (
        <p className="mt-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Odeme tamamlanamadi. Lutfen tekrar deneyin.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-neutral-600">
            Bu ekran test amaclidir. Asagidaki buton ile basarili odeme callbacki tetiklenir.
          </p>
          <p className="mt-3 rounded-lg bg-neutral-100 p-2 text-xs text-neutral-600">
            Token: {token}
          </p>
          <Link
            href={callbackUrl}
            className="mt-4 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Odemeyi Basarili Tamamla
          </Link>
        </>
      )}
    </main>
  );
}
