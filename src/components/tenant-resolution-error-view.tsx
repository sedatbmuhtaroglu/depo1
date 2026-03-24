"use client";

import Image from "next/image";
import Link from "next/link";
import type { TenantResolutionCode } from "@/lib/tenancy/tenant-resolution-error";
import { buttonClasses, cardClasses } from "@/lib/ui/button-variants";

type Props = { code: TenantResolutionCode };

const COPY: Record<
  TenantResolutionCode,
  {
    title: string;
    description: string;
    primary: { href: string; label: string };
    secondary: { href: string; label: string };
  }
> = {
  AUTH_REQUIRED: {
    title: "Bu sayfaya erisim icin giris yapmalisiniz",
    description:
      "Bu bolum yalnizca yetkili personel icindir. Devam etmek icin restoran giris ekranindan oturum acin.",
    primary: { href: "/glidragiris", label: "Giris ekranina don" },
    secondary: { href: "/", label: "Ana sayfaya don" },
  },
  TENANT_NOT_FOUND: {
    title: "Restoran bulunamadi",
    description:
      "Baglanti gecersiz veya restoran artik kullanilamiyor olabilir. Adresi kontrol edin veya ana sayfaya donun.",
    primary: { href: "/", label: "Ana sayfaya don" },
    secondary: { href: "/glidragiris", label: "Giris ekranina don" },
  },
  INVALID_TENANT_SLUG: {
    title: "Restoran adresi gecersiz",
    description:
      "Baglantidaki restoran slug degeri gecersiz gorunuyor. Linki yeniden olusturun veya giris ekranindan devam edin.",
    primary: { href: "/glidragiris", label: "Giris ekranina don" },
    secondary: { href: "/", label: "Ana sayfaya don" },
  },
};

export function TenantResolutionErrorView({ code }: Props) {
  const c = COPY[code];

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[var(--ui-bg-canvas)] px-4 py-10">
      <div
        className={cardClasses({
          tone: "subtle",
          className:
            "w-full max-w-md border border-[var(--ui-border)] px-6 py-8 text-center shadow-[var(--ui-card-shadow)]",
        })}
      >
        <div className="mx-auto mb-6 flex max-w-[min(100%,340px)] justify-center">
          <Image
            src="/illustrations/restaurant-not-found.svg"
            alt=""
            width={340}
            height={240}
            className="h-auto w-full max-w-[340px]"
            priority
            unoptimized
          />
        </div>
        <h1 className="text-lg font-semibold tracking-tight text-[var(--ui-text-primary)]">
          {c.title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--ui-text-secondary)]">
          {c.description}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={c.primary.href}
            className={buttonClasses({
              variant: "primary",
              size: "md",
              fullWidth: true,
              className: "sm:w-auto sm:min-w-[200px]",
            })}
          >
            {c.primary.label}
          </Link>
          <Link
            href={c.secondary.href}
            className={buttonClasses({
              variant: "outline",
              size: "md",
              fullWidth: true,
              className: "sm:w-auto sm:min-w-[200px]",
            })}
          >
            {c.secondary.label}
          </Link>
        </div>
      </div>
    </div>
  );
}
