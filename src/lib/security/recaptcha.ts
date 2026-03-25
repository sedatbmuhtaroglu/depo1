import "server-only";

const RECAPTCHA_VERIFY_ENDPOINT = "https://www.google.com/recaptcha/api/siteverify";
const DEFAULT_MIN_SCORE = 0.5;

type RecaptchaVerifyPayload = {
  success?: unknown;
  score?: unknown;
  action?: unknown;
  hostname?: unknown;
  ["error-codes"]?: unknown;
};

export type RecaptchaVerifyFailReason =
  | "config_missing"
  | "token_missing"
  | "request_failed"
  | "response_invalid"
  | "google_rejected"
  | "action_mismatch"
  | "score_missing"
  | "score_too_low";

export type RecaptchaVerifyResult =
  | {
      ok: true;
      score: number;
      action: string;
      hostname: string | null;
    }
  | {
      ok: false;
      reason: RecaptchaVerifyFailReason;
      score?: number | null;
      action?: string | null;
      errorCodes?: string[];
    };

export type VerifyRecaptchaV3Params = {
  token: string | null | undefined;
  expectedAction: string;
  remoteIp?: string | null;
  minScore?: number;
};

function getRecaptchaSecretKey(): string {
  return process.env.RECAPTCHA_SECRET_KEY?.trim() ?? "";
}

function parsePayload(raw: unknown): RecaptchaVerifyPayload | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as RecaptchaVerifyPayload;
}

function normalizeErrorCodes(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => String(entry ?? "").trim()).filter((entry) => entry.length > 0);
}

function normalizeAction(value: unknown): string | null {
  const action = String(value ?? "").trim();
  return action.length > 0 ? action : null;
}

function normalizeScore(value: unknown): number | null {
  const score = Number(value);
  if (!Number.isFinite(score)) return null;
  if (score < 0 || score > 1) return null;
  return score;
}

export function isRecaptchaConfigured(): boolean {
  return getRecaptchaSecretKey().length > 0;
}

export async function verifyRecaptchaV3(params: VerifyRecaptchaV3Params): Promise<RecaptchaVerifyResult> {
  const secretKey = getRecaptchaSecretKey();
  if (!secretKey) {
    return { ok: false, reason: "config_missing" };
  }

  const token = (params.token ?? "").trim();
  if (!token) {
    return { ok: false, reason: "token_missing" };
  }

  const minScore = typeof params.minScore === "number" ? params.minScore : DEFAULT_MIN_SCORE;

  const form = new URLSearchParams();
  form.set("secret", secretKey);
  form.set("response", token);
  if (params.remoteIp && params.remoteIp !== "unknown") {
    form.set("remoteip", params.remoteIp);
  }

  let response: Response;
  try {
    response = await fetch(RECAPTCHA_VERIFY_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      cache: "no-store",
    });
  } catch {
    return { ok: false, reason: "request_failed" };
  }

  if (!response.ok) {
    return { ok: false, reason: "request_failed" };
  }

  let rawPayload: unknown;
  try {
    rawPayload = await response.json();
  } catch {
    return { ok: false, reason: "response_invalid" };
  }

  const payload = parsePayload(rawPayload);
  if (!payload) {
    return { ok: false, reason: "response_invalid" };
  }

  const success = Boolean(payload.success);
  const score = normalizeScore(payload.score);
  const action = normalizeAction(payload.action);
  const hostname = normalizeAction(payload.hostname);
  const errorCodes = normalizeErrorCodes(payload["error-codes"]);

  if (!success) {
    return {
      ok: false,
      reason: "google_rejected",
      score,
      action,
      errorCodes,
    };
  }

  if (!action || action !== params.expectedAction) {
    return {
      ok: false,
      reason: "action_mismatch",
      score,
      action,
      errorCodes,
    };
  }

  if (score === null) {
    return {
      ok: false,
      reason: "score_missing",
      action,
      errorCodes,
    };
  }

  if (score < minScore) {
    return {
      ok: false,
      reason: "score_too_low",
      score,
      action,
      errorCodes,
    };
  }

  return {
    ok: true,
    score,
    action,
    hostname,
  };
}
