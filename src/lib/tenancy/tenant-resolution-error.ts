/**
 * Controlled errors when tenant context cannot be resolved for UI.
 * Distinct from arbitrary server failures — see root `error.tsx`.
 */
export type TenantResolutionCode = "AUTH_REQUIRED" | "TENANT_NOT_FOUND" | "INVALID_TENANT_SLUG";

/** Stable messages so client error boundary can recover `code` if `name` is lost in serialization. */
export const TENANT_RESOLUTION_MESSAGE = {
  AUTH_REQUIRED: "__MENUCY_TENANT_AUTH_REQUIRED__",
  TENANT_NOT_FOUND: "__MENUCY_TENANT_NOT_FOUND__",
  INVALID_TENANT_SLUG: "__MENUCY_INVALID_TENANT_SLUG__",
} as const;

export class TenantResolutionError extends Error {
  readonly code: TenantResolutionCode;

  constructor(code: TenantResolutionCode) {
    super(
      code === "AUTH_REQUIRED"
        ? TENANT_RESOLUTION_MESSAGE.AUTH_REQUIRED
        : code === "INVALID_TENANT_SLUG"
          ? TENANT_RESOLUTION_MESSAGE.INVALID_TENANT_SLUG
          : TENANT_RESOLUTION_MESSAGE.TENANT_NOT_FOUND,
    );
    this.name = "TenantResolutionError";
    this.code = code;
  }
}

function checkError(e: unknown): TenantResolutionCode | null {
  if (!e || typeof e !== "object") return null;
  const err = e as Error & { code?: string; cause?: unknown };
  const msg = String(err?.message ?? "");

  if (
    err.name === "TenantResolutionError" &&
    (err.code === "AUTH_REQUIRED" ||
      err.code === "TENANT_NOT_FOUND" ||
      err.code === "INVALID_TENANT_SLUG")
  ) {
    return err.code;
  }
  if (msg.includes(TENANT_RESOLUTION_MESSAGE.AUTH_REQUIRED)) return "AUTH_REQUIRED";
  if (msg.includes(TENANT_RESOLUTION_MESSAGE.TENANT_NOT_FOUND)) return "TENANT_NOT_FOUND";
  if (msg.includes(TENANT_RESOLUTION_MESSAGE.INVALID_TENANT_SLUG)) {
    return "INVALID_TENANT_SLUG";
  }

  if (err.cause) return checkError(err.cause);
  return null;
}

export function parseTenantResolutionCode(error: unknown): TenantResolutionCode | null {
  return checkError(error);
}
