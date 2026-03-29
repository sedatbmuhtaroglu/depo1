"use client";

const SOUND_ENABLED_KEY = "menucy:ops-sound-enabled:v1";
const SOUND_FILES = {
  new_order: "/sounds/notification-bell.wav",
  cancel_alert: "/sounds/cancel-alert.wav",
} as const;

type AlertSoundType = keyof typeof SOUND_FILES;
type PlayResult = { ok: boolean; reason?: string };

export function isOpsSoundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(SOUND_ENABLED_KEY) === "1";
}

export function setOpsSoundEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SOUND_ENABLED_KEY, enabled ? "1" : "0");
  window.dispatchEvent(new Event("menucy:ops-sound-changed"));
}

export async function primeOpsSound(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  try {
    const audio = new Audio(SOUND_FILES.new_order);
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

function playWebAudioFallback(frequency = 880, seconds = 0.15) {
  if (typeof window === "undefined") return;
  try {
    const ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    osc.type = "sine";
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + seconds);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + seconds);
  } catch {
    // Browser may block sound autoplay; fail silently.
  }
}

export function playOrderAlertBeep(type: AlertSoundType = "new_order"): Promise<PlayResult> {
  if (typeof window === "undefined") {
    return Promise.resolve({ ok: false, reason: "non_browser" });
  }
  if (!isOpsSoundEnabled()) {
    return Promise.resolve({ ok: false, reason: "disabled" } satisfies PlayResult);
  }

  try {
    const audio = new Audio(SOUND_FILES[type]);
    audio.preload = "auto";
    audio.volume = type === "cancel_alert" ? 0.75 : 0.65;
    return audio
      .play()
      .then(() => ({ ok: true } satisfies PlayResult))
      .catch((error) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[ops-sound] play failed, using fallback",
            error instanceof Error ? error.message : String(error),
          );
        }
        playWebAudioFallback(
          type === "cancel_alert" ? 640 : 880,
          type === "cancel_alert" ? 0.25 : 0.15,
        );
        return { ok: false, reason: "play_failed_fallback" } satisfies PlayResult;
      });
  } catch {
    playWebAudioFallback(
      type === "cancel_alert" ? 640 : 880,
      type === "cancel_alert" ? 0.25 : 0.15,
    );
    return Promise.resolve({ ok: false, reason: "audio_construct_failed_fallback" } satisfies PlayResult);
  }
}
