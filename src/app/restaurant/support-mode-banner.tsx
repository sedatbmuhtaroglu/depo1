"use client";

import React, { useEffect, useState } from "react";
import { Headphones } from "lucide-react";
import { exitSupportSessionAction } from "@/app/actions/support-session-exit";

type Props = {
  tenantName: string;
  tenantSlug: string;
  hqAdminUsername: string;
  reason: string;
  expiresAtMs: number;
};

export default function SupportModeBanner({
  tenantName,
  tenantSlug,
  hqAdminUsername,
  reason,
  expiresAtMs,
}: Props) {
  const [remainingSec, setRemainingSec] = useState(() =>
    Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000)),
  );

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemainingSec(Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000)));
    }, 1000);
    return () => window.clearInterval(id);
  }, [expiresAtMs]);

  const mm = Math.floor(remainingSec / 60);
  const ss = remainingSec % 60;
  const timeLabel = `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;

  return (
    <div className="support-mode-banner sticky top-0 z-[45] border-b border-amber-200/80 bg-gradient-to-r from-amber-50 via-amber-50/95 to-amber-100/90 px-4 py-2.5 text-amber-950 shadow-sm dark:border-amber-900/40 dark:from-amber-950/90 dark:via-amber-950/80 dark:to-amber-900/70 dark:text-amber-50">
      <div className="mx-auto flex w-full max-w-[1720px] flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-2 sm:items-center">
          <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-200/80 text-amber-900 dark:bg-amber-800/60 dark:text-amber-100">
            <Headphones className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/80 dark:text-amber-100/90">
              Destek modu aktif
            </p>
            <p className="mt-0.5 text-sm font-medium leading-snug">
              <span className="text-[var(--ui-text-primary)] dark:text-amber-50">{tenantName}</span>
              <span className="text-[var(--ui-text-secondary)] dark:text-amber-100/80"> · {tenantSlug}</span>
            </p>
            <p className="mt-0.5 line-clamp-2 text-xs text-[var(--ui-text-secondary)] dark:text-amber-100/85">
              <span className="font-medium text-[var(--ui-text-primary)] dark:text-amber-50">
                {hqAdminUsername}
              </span>
              <span className="mx-1.5 text-[var(--ui-text-muted)]">·</span>
              {reason}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          <span className="inline-flex items-center rounded-full border border-amber-300/70 bg-white/60 px-2.5 py-1 text-xs font-semibold tabular-nums text-amber-950 dark:border-amber-700/50 dark:bg-amber-950/40 dark:text-amber-50">
            Kalan: {timeLabel}
          </span>
          <form action={exitSupportSessionAction}>
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-lg border border-amber-800/20 bg-amber-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-950 dark:border-amber-300/20 dark:bg-amber-200 dark:text-amber-950 dark:hover:bg-amber-100"
            >
              Destek modundan çık
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
