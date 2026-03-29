/** Mask email for admin lists: j***@example.com */
export function maskEmailForDisplay(email: string | null | undefined): string | null {
  if (!email?.trim()) return null;
  const s = email.trim();
  const at = s.indexOf("@");
  if (at <= 0) return "***";
  const local = s.slice(0, at);
  const domain = s.slice(at + 1);
  const show = local.length <= 1 ? "*" : `${local[0]}***`;
  return `${show}@${domain}`;
}

/** Mask phone: show last 4 if available else **** */
export function maskPhoneForDisplay(phone: string | null | undefined, last4: string | null | undefined): string | null {
  const p = phone?.trim();
  const l4 = last4?.trim();
  if (l4 && /^\d{4}$/.test(l4)) return `*** *** ** ${l4}`;
  if (p && p.length >= 4) return `***${p.slice(-4)}`;
  if (p) return "****";
  return null;
}

export function maskContactNameForDisplay(fullName: string | null | undefined): string | null {
  const s = fullName?.trim();
  if (!s) return null;
  const first = s[0] ?? "*";
  return `${first}***`;
}
