/** Avoid logging raw PII; keep enough to debug. */
export function redactEmail(value: string | null | undefined): string {
  if (!value?.trim()) return "[empty]";
  const m = value.trim();
  const at = m.indexOf("@");
  if (at <= 0) return "[redacted]";
  return `${m[0] ?? "?"}***@${m.slice(at + 1)}`;
}

export function redactPhone(value: string | null | undefined): string {
  if (!value?.trim()) return "[empty]";
  const d = value.replace(/\D/g, "");
  if (d.length < 4) return "[redacted]";
  return `***${d.slice(-4)}`;
}
