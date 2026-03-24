/**
 * Dev-only notice when payment secret encryption uses the explicit local fallback.
 * Single-shot to avoid log spam. Uses console.warn (Edge-safe; no process.stderr).
 */
let devFallbackWarned = false;

export function warnDevPaymentSecretFallbackOnce(): void {
  if (devFallbackWarned) return;
  devFallbackWarned = true;
  console.warn(
    "[secret-crypto] TENANT_PAYMENT_SECRET_KEY is unset; dev fallback active. Set the env key or ALLOW_DEV_PAYMENT_SECRET_FALLBACK=false.",
  );
}
