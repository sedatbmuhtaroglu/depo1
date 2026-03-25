"use client";

type GrecaptchaV3 = {
  ready: (callback: () => void) => void;
  execute: (siteKey: string, options: { action: string }) => Promise<string>;
};

declare global {
  interface Window {
    grecaptcha?: GrecaptchaV3;
  }
}

const DEFAULT_TIMEOUT_MS = 8_000;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function getWindowGrecaptcha(): GrecaptchaV3 | null {
  if (typeof window === "undefined") return null;
  if (!window.grecaptcha) return null;
  return window.grecaptcha;
}

async function waitForGrecaptcha(timeoutMs = DEFAULT_TIMEOUT_MS): Promise<GrecaptchaV3 | null> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const grecaptcha = getWindowGrecaptcha();
    if (grecaptcha) return grecaptcha;
    await wait(120);
  }
  return null;
}

function waitUntilReady(grecaptcha: GrecaptchaV3): Promise<void> {
  return new Promise((resolve) => {
    grecaptcha.ready(() => resolve());
  });
}

export function getRecaptchaSiteKey(): string {
  return process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() ?? "";
}

export async function executeRecaptchaV3(action: string): Promise<string | null> {
  const siteKey = getRecaptchaSiteKey();
  if (!siteKey) return null;

  const grecaptcha = await waitForGrecaptcha();
  if (!grecaptcha) return null;

  try {
    await waitUntilReady(grecaptcha);
    const token = await grecaptcha.execute(siteKey, { action });
    const normalized = token.trim();
    return normalized.length > 0 ? normalized : null;
  } catch {
    return null;
  }
}
