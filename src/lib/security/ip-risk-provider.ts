import { IpRiskResult } from "@/lib/security/types";

type IpApiResponse = {
  status?: string;
  countryCode?: string;
  city?: string;
  timezone?: string;
  lat?: number;
  lon?: number;
  proxy?: boolean;
  hosting?: boolean;
  mobile?: boolean;
};

function isPrivateIp(ip: string): boolean {
  if (!ip || ip === "unknown") return true;

  const normalized = ip.trim().toLowerCase();
  if (
    normalized === "::1" ||
    normalized === "127.0.0.1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
  ) {
    return true;
  }

  const ipv4 = normalized.replace(/^::ffff:/, "");
  const parts = ipv4.split(".");
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(Number(part)))) {
    return false;
  }

  const [a, b] = parts.map((part) => Number(part));
  if (a === 10) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 127) return true;

  return false;
}

export async function assessIpRisk(ipRaw: string): Promise<IpRiskResult> {
  if (!ipRaw || isPrivateIp(ipRaw)) {
    return { risk: "low", provider: "local", notes: "private_or_unknown_ip" };
  }

  const endpoint = `http://ip-api.com/json/${encodeURIComponent(ipRaw)}?fields=status,countryCode,city,timezone,lat,lon,proxy,hosting,mobile`;
  const timeoutMs = 1500;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(endpoint, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timer);

    if (!response.ok) {
      return { risk: "low", provider: "ip-api", notes: "service_non_200" };
    }

    const data = (await response.json()) as IpApiResponse;
    if (data.status !== "success") {
      return { risk: "low", provider: "ip-api", notes: "service_failed" };
    }

    const proxyOrHosting = Boolean(data.proxy || data.hosting);
    const risk: IpRiskResult["risk"] = proxyOrHosting
      ? data.hosting
        ? "high"
        : "medium"
      : "low";

    return {
      risk,
      provider: "ip-api",
      country: data.countryCode ?? null,
      city: data.city ?? null,
      timezone: data.timezone ?? null,
      latitude: data.lat ?? null,
      longitude: data.lon ?? null,
      isProxy: data.proxy ?? null,
      isHosting: data.hosting ?? null,
      notes: data.mobile ? "mobile_network" : null,
    };
  } catch {
    // Fail-open: servis hatası siparişi doğrudan durdurmaz, sadece sinyal kaybı olur.
    return { risk: "low", provider: "ip-api", notes: "service_unavailable" };
  }
}
