import { decryptPiiValue, isPiiCiphertext } from "@/lib/pii/pii-crypto";
import { maskEmailForDisplay, maskPhoneForDisplay } from "@/lib/pii/pii-mask";

export type LeadLikePiiRow = {
  email: string | null;
  emailEncrypted: string | null;
  emailMasked: string | null;
  phone: string | null;
  phoneEncrypted: string | null;
  phoneLast4: string | null;
  contactName: string;
  contactNameEncrypted: string | null;
  contactNameMasked: string | null;
};

export function resolveLeadEmail(row: Pick<LeadLikePiiRow, "email" | "emailEncrypted">): string | null {
  if (row.emailEncrypted && isPiiCiphertext(row.emailEncrypted)) {
    return decryptPiiValue(row.emailEncrypted);
  }
  return row.email;
}

export function resolveLeadPhone(row: Pick<LeadLikePiiRow, "phone" | "phoneEncrypted">): string | null {
  if (row.phoneEncrypted && isPiiCiphertext(row.phoneEncrypted)) {
    return decryptPiiValue(row.phoneEncrypted);
  }
  return row.phone;
}

export function resolveLeadContactName(
  row: Pick<LeadLikePiiRow, "contactName" | "contactNameEncrypted">,
): string {
  if (row.contactNameEncrypted && isPiiCiphertext(row.contactNameEncrypted)) {
    return decryptPiiValue(row.contactNameEncrypted) ?? row.contactName;
  }
  return row.contactName;
}

/** List / non-sensitive: prefer stored masked; never expose plaintext. */
export function displayEmailForList(row: LeadLikePiiRow): string | null {
  if (row.emailMasked?.trim()) return row.emailMasked;
  if (row.emailEncrypted && isPiiCiphertext(row.emailEncrypted)) return "***";
  const plain = resolveLeadEmail(row);
  return plain ? maskEmailForDisplay(plain) : null;
}

export function displayPhoneForList(row: LeadLikePiiRow): string | null {
  if (row.phoneLast4?.trim()) {
    return maskPhoneForDisplay(null, row.phoneLast4);
  }
  if (row.phoneEncrypted && isPiiCiphertext(row.phoneEncrypted)) return "***";
  const plain = resolveLeadPhone(row);
  return plain ? maskPhoneForDisplay(plain, null) : null;
}

export function displayContactNameForList(row: LeadLikePiiRow): string {
  if (row.contactNameMasked?.trim()) return row.contactNameMasked;
  if (row.contactNameEncrypted && isPiiCiphertext(row.contactNameEncrypted)) return "***";
  return row.contactName;
}

export type StaffPiiRow = {
  email: string | null;
  emailEncrypted: string | null;
  emailMasked: string | null;
  phone: string | null;
  phoneEncrypted: string | null;
  phoneLast4: string | null;
};

export function resolveStaffEmail(row: StaffPiiRow): string | null {
  if (row.emailEncrypted && isPiiCiphertext(row.emailEncrypted)) {
    return decryptPiiValue(row.emailEncrypted);
  }
  return row.email;
}

export function resolveStaffPhone(row: StaffPiiRow): string | null {
  if (row.phoneEncrypted && isPiiCiphertext(row.phoneEncrypted)) {
    return decryptPiiValue(row.phoneEncrypted);
  }
  return row.phone;
}
