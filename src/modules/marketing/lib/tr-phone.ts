/** TR cep: 5xxxxxxxxx, 05..., +905... */
export function parseTrMobileDigits(input: string): string | null {
  const raw = input.replace(/\D/g, "");
  if (raw.length === 12 && raw.startsWith("90") && raw[2] === "5") {
    return raw.slice(2);
  }
  if (raw.length === 11 && raw.startsWith("0") && raw[1] === "5") {
    return raw.slice(1);
  }
  if (raw.length === 10 && raw.startsWith("5")) {
    return raw;
  }
  return null;
}

export function isValidTrMobile(input: string): boolean {
  const d = parseTrMobileDigits(input);
  return d !== null && /^5[0-9]{9}$/.test(d);
}

export function formatTrMobileForStorage(input: string): string {
  const d = parseTrMobileDigits(input);
  if (!d) return input.trim().slice(0, 32);
  return `0${d}`.slice(0, 32);
}
