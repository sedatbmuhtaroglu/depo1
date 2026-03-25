"use client";

import { useState, useTransition } from "react";
import { buttonClasses } from "@/lib/ui/button-variants";
import { createContentPreviewLinkAction } from "@/modules/hq/actions/content";

type ContentPreviewLinkGeneratorProps = {
  targetType: "PAGE" | "BLOG_POST";
  targetId?: number;
  pathname: string;
};

function formatDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function ContentPreviewLinkGenerator({
  targetType,
  targetId,
  pathname,
}: ContentPreviewLinkGeneratorProps) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string>("");
  const [link, setLink] = useState<string>("");
  const [expiresAt, setExpiresAt] = useState<string>("");

  return (
    <div className="rounded-xl border border-[var(--ui-border)] bg-[var(--ui-surface-subtle)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!targetId || isPending}
          className={buttonClasses({ variant: "outline", size: "sm" })}
          onClick={() => {
            if (!targetId) {
              setMessage("Once kaydedip tekrar deneyin.");
              return;
            }
            startTransition(async () => {
              const result = await createContentPreviewLinkAction({
                targetType,
                targetId,
                pathname,
              });

              setMessage(result.message);
              if (result.success) {
                setLink(result.url);
                setExpiresAt(result.expiresAt);
              }
            });
          }}
        >
          {isPending ? "Link uretiliyor..." : "Guvenli Preview Linki Uret"}
        </button>

        {link ? (
          <button
            type="button"
            className={buttonClasses({ variant: "ghost", size: "sm" })}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(link);
                setMessage("Preview link panoya kopyalandi.");
              } catch {
                setMessage("Link kopyalanamadi. Elle kopyalayin.");
              }
            }}
          >
            Linki Kopyala
          </button>
        ) : null}
      </div>

      {message ? (
        <p className="mt-2 text-xs text-[var(--ui-text-secondary)]">{message}</p>
      ) : null}

      {link ? (
        <div className="mt-2 rounded-lg border border-[var(--ui-border-subtle)] bg-[var(--ui-surface)] p-2">
          <p className="break-all text-xs text-[var(--ui-text-primary)]">{link}</p>
          {expiresAt ? (
            <p className="mt-1 text-[11px] text-[var(--ui-text-secondary)]">Gecerlilik: {formatDate(expiresAt)}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
