"use client";

import { isOpsSoundEnabled } from "@/lib/order-alert-sound";

const SOUNDS = {
  order: "/sounds/order-alert.mp3",
  waiter: "/sounds/waiter-alert.mp3",
} as const;

export type WaiterPanelSoundKind = keyof typeof SOUNDS;

type PlayResult = { ok: boolean; reason?: string };

/**
 * Silent unlock for autoplay policies (must run after a user gesture).
 */
export async function primeWaiterPanelSound(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const audio = new Audio(SOUNDS.order);
    audio.preload = "auto";
    audio.volume = 0.01;
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    return true;
  } catch {
    return false;
  }
}

export function playWaiterPanelSound(kind: WaiterPanelSoundKind): Promise<PlayResult> {
  if (typeof window === "undefined") {
    return Promise.resolve({ ok: false, reason: "non_browser" });
  }
  if (!isOpsSoundEnabled()) {
    return Promise.resolve({ ok: false, reason: "disabled" });
  }
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    return Promise.resolve({ ok: false, reason: "tab_hidden" });
  }

  try {
    const audio = new Audio(SOUNDS[kind]);
    audio.preload = "auto";
    audio.volume = kind === "waiter" ? 0.72 : 0.68;
    return audio
      .play()
      .then(() => ({ ok: true } satisfies PlayResult))
      .catch((error) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[waiter-panel-sound] play failed",
            kind,
            error instanceof Error ? error.message : String(error),
          );
        }
        return { ok: false, reason: "play_failed" } satisfies PlayResult;
      });
  } catch {
    return Promise.resolve({ ok: false, reason: "audio_construct_failed" });
  }
}

export function playWaiterPanelSoundsSequential(
  kinds: WaiterPanelSoundKind[],
  gapMs = 160,
): Promise<void> {
  if (kinds.length === 0) return Promise.resolve();
  let chain: Promise<unknown> = Promise.resolve();
  for (let i = 0; i < kinds.length; i++) {
    const k = kinds[i];
    chain = chain.then(() => playWaiterPanelSound(k)).then(() => {
      if (i < kinds.length - 1) {
        return new Promise((r) => setTimeout(r, gapMs));
      }
    });
  }
  return chain.then(() => undefined);
}
