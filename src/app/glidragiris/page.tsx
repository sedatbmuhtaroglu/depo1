import { getAuthenticatedAdminSession, loadTenantStaffForAuth } from "@/lib/auth";
import { getCurrentTenantOrThrow } from "@/lib/tenancy/context";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";
import {
  resolveStaffPostLoginTarget,
  staffPostLoginErrorMessage,
} from "@/lib/staff-post-login-redirect";

type GlidraLoginPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

export default async function GlidraLoginPage({ searchParams }: GlidraLoginPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const urlErrorCode =
    typeof resolvedSearchParams.error === "string" ? resolvedSearchParams.error : undefined;
  const urlErrorMessage = staffPostLoginErrorMessage(urlErrorCode);

  const session = await getAuthenticatedAdminSession();
  let sessionBlockMessage: string | null = null;

  if (session?.username && session.tenantId != null) {
    const tenant = await getCurrentTenantOrThrow().catch(() => null);

    if (tenant && tenant.tenantId === session.tenantId) {
      const staff = await loadTenantStaffForAuth(session.tenantId, session.username);

      if (staff?.isActive && staff.role) {
        const target = resolveStaffPostLoginTarget(staff);
        if (target.kind === "redirect") {
          redirect(target.path);
        }
        sessionBlockMessage =
          staffPostLoginErrorMessage(target.errorCode) ?? "Bu hesap için giriş şu an mümkün değil.";
      }
    }
  }

  const initialBannerError = urlErrorMessage ?? sessionBlockMessage;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#f5f5f4,_#e7e5e4_45%,_#d6d3d1)] px-4 py-12">
      <div className="w-full max-w-md rounded-[28px] border border-white/60 bg-white/90 p-8 shadow-2xl shadow-neutral-900/10 backdrop-blur">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-neutral-500">Glidra</p>
          <h1 className="mt-3 text-3xl font-semibold text-neutral-950">Yönetici Girişi</h1>
          <p className="mt-2 text-sm text-neutral-600">
            Sipariş yönetim paneline erişmek için giriş yapın.
          </p>
        </div>

        <LoginForm initialBannerError={initialBannerError} />
      </div>
    </main>
  );
}
