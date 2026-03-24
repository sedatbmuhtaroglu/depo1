"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const DEFAULT_INTERVAL_MS = 20_000;

export default function RefreshPolling({
  intervalMs = DEFAULT_INTERVAL_MS,
  pauseWhenHidden = true,
}: {
  intervalMs?: number;
  pauseWhenHidden?: boolean;
}) {
  const router = useRouter();

  useEffect(() => {
    if (intervalMs < 5000) return;
    const id = setInterval(() => {
      if (pauseWhenHidden && typeof document !== "undefined" && document.hidden) {
        return;
      }
      router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs, pauseWhenHidden]);

  return null;
}
