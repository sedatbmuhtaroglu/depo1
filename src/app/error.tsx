"use client";

import { useEffect } from "react";
import { parseTenantResolutionCode } from "@/lib/tenancy/tenant-resolution-error";
import { TenantResolutionErrorView } from "@/components/tenant-resolution-error-view";
import { buttonClasses, cardClasses } from "@/lib/ui/button-variants";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const tenantCode = parseTenantResolutionCode(error);

  useEffect(() => {
    if (tenantCode == null) {
      console.error("[app-error]", error);
    }
  }, [tenantCode, error]);

  if (tenantCode) {
    return <TenantResolutionErrorView code={tenantCode} />;
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--ui-bg-canvas)] px-4 py-10">
      <div
        className={cardClasses({
          tone: "default",
          className: "w-full max-w-md border border-[var(--ui-border)] px-6 py-8 text-center shadow-[var(--ui-card-shadow)]",
        })}
      >
        <h1 className="text-lg font-semibold text-[var(--ui-text-primary)]">Bir sorun oluştu</h1>
        <p className="mt-2 text-sm text-[var(--ui-text-secondary)]">
          İşlem tamamlanamadı. Sayfayı yenileyerek tekrar deneyebilirsiniz.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-[var(--ui-text-muted)]">Ref: {error.digest}</p>
        ) : null}
        <button
          type="button"
          onClick={() => reset()}
          className={buttonClasses({ variant: "primary", size: "md", fullWidth: true, className: "mt-8" })}
        >
          Tekrar dene
        </button>
      </div>
    </div>
  );
}
