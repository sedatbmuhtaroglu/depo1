import crypto from "crypto";

function normalize(value?: string | null): string {
  return (value ?? "").trim().toLowerCase();
}

export function hashValue(value?: string | null): string | null {
  const normalized = normalize(value);
  if (!normalized) return null;
  return crypto.createHash("sha256").update(normalized).digest("hex");
}
