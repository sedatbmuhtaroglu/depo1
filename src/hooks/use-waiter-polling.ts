"use client";

import { useEffect, useRef } from "react";

const DEFAULT_INTERVAL_MS = 3000;

/**
 * Fixed-interval polling with:
 * - no overlapping in-flight callbacks
 * - pauses while document is hidden; runs once when tab becomes visible again
 * - cleanup on unmount
 */
export function useWaiterPolling(
  onTick: () => Promise<void>,
  intervalMs: number = DEFAULT_INTERVAL_MS,
) {
  const onTickRef = useRef(onTick);
  onTickRef.current = onTick;
  const inFlightRef = useRef(false);

  useEffect(() => {
    const run = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        return;
      }
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      try {
        await onTickRef.current();
      } catch (error) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[waiter-poll] tick failed",
            error instanceof Error ? error.message : String(error),
          );
        }
      } finally {
        inFlightRef.current = false;
      }
    };

    const intervalId = setInterval(() => {
      void run();
    }, intervalMs);

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void run();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [intervalMs]);
}
