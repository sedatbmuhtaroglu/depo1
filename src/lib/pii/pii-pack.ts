import { blindIndexHex } from "@/lib/pii/pii-blind-index";
import { encryptPiiValue } from "@/lib/pii/pii-crypto";
import { requirePiiKeysForWrite } from "@/lib/pii/pii-env";
import { maskContactNameForDisplay, maskEmailForDisplay } from "@/lib/pii/pii-mask";
import {
  normalizeContactNameForPii,
  normalizeEmailForPii,
  normalizePhoneForPii,
} from "@/lib/pii/pii-normalize";

export type PackedPiiTriple = {
  emailEncrypted: string | null;
  emailHash: string | null;
  emailMasked: string | null;
  email: null;
  phoneEncrypted: string | null;
  phoneHash: string | null;
  phoneLast4: string | null;
  phone: null;
  contactNameEncrypted: string | null;
  contactNameHash: string | null;
  contactNameMasked: string | null;
  contactName: string;
};

function last4Digits(value: string): string | null {
  const d = value.replace(/\D/g, "");
  if (d.length < 4) return null;
  return d.slice(-4);
}

export function packLeadLikePii(input: {
  email: string | null;
  phone: string | null;
  contactName: string;
}): PackedPiiTriple {
  const { enc } = requirePiiKeysForWrite();

  const emailNorm = normalizeEmailForPii(input.email);
  const phoneNorm = normalizePhoneForPii(input.phone);
  const nameNorm = normalizeContactNameForPii(input.contactName);
  const contactPlain = input.contactName.trim();
  if (!contactPlain) {
    throw new Error("[PII] contactName required");
  }

  const emailEncrypted = emailNorm ? encryptPiiValue(emailNorm, enc) : null;
  const emailHash = emailNorm ? blindIndexHex("email", emailNorm) : null;
  const emailMasked = emailNorm ? maskEmailForDisplay(emailNorm) : null;

  const phoneEncrypted = phoneNorm ? encryptPiiValue(phoneNorm, enc) : null;
  const phoneHash = phoneNorm ? blindIndexHex("phone", phoneNorm) : null;
  const phoneLast4 = phoneNorm ? last4Digits(phoneNorm) : null;

  const hashBasis = nameNorm ?? contactPlain.toLowerCase();
  const contactNameEncrypted = encryptPiiValue(contactPlain, enc);
  const contactNameHash = blindIndexHex("contactName", hashBasis);
  const contactNameMasked = maskContactNameForDisplay(contactPlain);

  return {
    emailEncrypted,
    emailHash,
    emailMasked,
    email: null,
    phoneEncrypted,
    phoneHash,
    phoneLast4,
    phone: null,
    contactNameEncrypted,
    contactNameHash,
    contactNameMasked,
    contactName: contactNameMasked ?? "...",
  };
}

export type StaffPiiWrite = {
  emailEncrypted: string | null;
  emailHash: string | null;
  emailMasked: string | null;
  email: null;
  phoneEncrypted: string | null;
  phoneHash: string | null;
  phoneLast4: string | null;
  phone: null;
};

export function packStaffPii(input: { email: string | null; phone: string | null }): StaffPiiWrite {
  const { enc } = requirePiiKeysForWrite();

  const emailNorm = normalizeEmailForPii(input.email);
  const phoneNorm = normalizePhoneForPii(input.phone);

  const emailEncrypted = emailNorm ? encryptPiiValue(emailNorm, enc) : null;
  const emailHash = emailNorm ? blindIndexHex("email", emailNorm) : null;
  const emailMasked = emailNorm ? maskEmailForDisplay(emailNorm) : null;

  const phoneEncrypted = phoneNorm ? encryptPiiValue(phoneNorm, enc) : null;
  const phoneHash = phoneNorm ? blindIndexHex("phone", phoneNorm) : null;
  const phoneLast4 = phoneNorm ? last4Digits(phoneNorm) : null;

  return {
    emailEncrypted,
    emailHash,
    emailMasked,
    email: null,
    phoneEncrypted,
    phoneHash,
    phoneLast4,
    phone: null,
  };
}
