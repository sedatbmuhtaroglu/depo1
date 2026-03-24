"use client";

import { ClientRiskSignals } from "@/lib/security/types";

type BuildClientRiskSignalsOptions = {
  location?: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number | null;
    capturedAtMs?: number | null;
  } | null;
};

function getScreenInfo(): string | null {
  if (typeof window === "undefined") return null;
  const w = window.screen?.width;
  const h = window.screen?.height;
  const ratio = window.devicePixelRatio;
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
  return `${w}x${h}@${ratio ?? 1}`;
}

function buildFingerprint(): string | null {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return null;
  }

  const parts = [
    navigator.userAgent || "",
    navigator.language || "",
    Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    navigator.platform || "",
    getScreenInfo() || "",
  ];

  const joined = parts.join("|").trim();
  return joined.length > 0 ? joined : null;
}

export function buildClientRiskSignals(
  options: BuildClientRiskSignalsOptions = {},
): ClientRiskSignals {
  const timezone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || null
      : null;

  const location = options.location
    ? {
        latitude: options.location.latitude,
        longitude: options.location.longitude,
        accuracyMeters: options.location.accuracyMeters ?? null,
        capturedAtMs: options.location.capturedAtMs ?? Date.now(),
      }
    : null;

  return {
    fingerprint: buildFingerprint(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    language: typeof navigator !== "undefined" ? navigator.language : null,
    timezone,
    platform: typeof navigator !== "undefined" ? navigator.platform : null,
    screen: getScreenInfo(),
    location,
  };
}
