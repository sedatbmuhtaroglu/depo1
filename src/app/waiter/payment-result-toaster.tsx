"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import { useRouter } from "next/navigation";

export default function PaymentResultToaster() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const payment = searchParams.get("payment");
    if (!payment) return;

    const reason = searchParams.get("reason");
    if (payment === "success") {
      toast.success("Ödeme alındı, hesap kapatıldı.");
    } else if (payment === "failed" || payment === "error") {
      const msg =
        reason === "missing_token"
          ? "Ödeme oturumu bulunamadı."
          : reason === "invalid_token"
            ? "Geçersiz ödeme oturumu."
            : reason === "settle_failed"
              ? "Hesap kapatılamadı."
              : reason
                ? decodeURIComponent(reason)
                : "Ödeme tamamlanamadı.";
      toast.error(msg);
    }

    const url = new URL(window.location.href);
    url.searchParams.delete("payment");
    url.searchParams.delete("reason");
    router.replace(url.pathname + url.search, { scroll: false });
  }, [searchParams, router]);

  return <Toaster position="top-center" />;
}
