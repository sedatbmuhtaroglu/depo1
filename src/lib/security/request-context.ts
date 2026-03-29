import { headers } from "next/headers";
import { hashValue } from "@/lib/security/hash";

export type RequestSecurityContext = {
  ipRaw: string;
  ipHash: string | null;
  userAgent: string;
  userAgentHash: string | null;
  acceptLanguage: string | null;
};

export async function getRequestSecurityContext(): Promise<RequestSecurityContext> {
  const h = await headers();
  const xff = h.get("x-forwarded-for") || "";
  const xri = h.get("x-real-ip") || "";
  const candidate = (xff.split(",")[0] || xri || "").trim();
  const ipRaw = candidate || "unknown";
  const userAgent = h.get("user-agent") || "unknown";
  const acceptLanguage = h.get("accept-language");

  return {
    ipRaw,
    ipHash: hashValue(ipRaw),
    userAgent,
    userAgentHash: hashValue(userAgent),
    acceptLanguage,
  };
}
