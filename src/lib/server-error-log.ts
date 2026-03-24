/**
 * Server-side error logging without dumping arbitrary objects in production.
 */
export function logServerError(scope: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  if (process.env.NODE_ENV === "production") {
    console.error(`[${scope}]`, message);
  } else {
    console.error(`[${scope}]`, error);
  }
}
