import { headers } from "next/headers";

/**
 * Kritik server action'lar için ek CSRF sinyali:
 * - `SameSite=Lax` + signed cookie çoğu cross-site senaryoda yeterli olsa da,
 *   tarayıcının `Sec-Fetch-Site: cross-site` gönderdiği istekleri production'da reddeder.
 * - Dev ortamında header eksikliği / tooling uyumu için varsayılan olarak gevşektir.
 */
export async function assertPrivilegedServerActionOrigin(): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const h = await headers();
  const site = h.get("sec-fetch-site");
  if (site === "cross-site") {
    throw new Error("Forbidden");
  }

  const origin = h.get("origin");
  const hostRaw = h.get("x-forwarded-host") ?? h.get("host");
  if (origin && hostRaw) {
    try {
      const o = new URL(origin);
      const hostOnly = hostRaw.split(":")[0]?.toLowerCase() ?? "";
      if (hostOnly && o.hostname.toLowerCase() !== hostOnly) {
        throw new Error("Forbidden");
      }
    } catch {
      throw new Error("Forbidden");
    }
  }
}
