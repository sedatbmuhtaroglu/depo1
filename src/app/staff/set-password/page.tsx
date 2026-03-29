import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedAdminSession, loadTenantStaffForAuth } from "@/lib/auth";
import { formatStaffDisplayName } from "@/lib/person-display-name";
import { validateStaffSetPasswordToken } from "@/lib/staff-set-password-token";
import { resolveStaffPostLoginTarget } from "@/lib/staff-post-login-redirect";
import SetPasswordForm from "./set-password-form";

export const dynamic = "force-dynamic";

type StaffSetPasswordPageProps = {
  searchParams?: Promise<{ token?: string; tenant?: string }>;
};

function tokenErrorMessage(
  code:
    | "INVALID_TOKEN"
    | "TOKEN_NOT_FOUND"
    | "TOKEN_EXPIRED"
    | "TOKEN_ALREADY_USED"
    | "STAFF_INACTIVE"
    | "PASSWORD_ALREADY_INITIALIZED",
): string {
  if (code === "TOKEN_EXPIRED") {
    return "Set-password linkinin suresi dolmus. HQ'dan yeni link isteyin.";
  }
  if (code === "TOKEN_ALREADY_USED") {
    return "Bu link daha once kullanilmis veya iptal edilmis.";
  }
  if (code === "STAFF_INACTIVE") {
    return "Bu hesap aktif degil. HQ ile iletisime gecin.";
  }
  if (code === "PASSWORD_ALREADY_INITIALIZED") {
    return "Bu hesap sifresini zaten olusturmus. /glidragiris ile giris yapabilirsiniz.";
  }
  return "Set-password linki gecersiz.";
}

function buildTenantLoginPath(tenantSlug: string): string {
  const encoded = encodeURIComponent(tenantSlug);
  return `/glidragiris?tenant=${encoded}`;
}

export default async function StaffSetPasswordPage({
  searchParams,
}: StaffSetPasswordPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const token = typeof resolvedSearchParams.token === "string" ? resolvedSearchParams.token.trim() : "";

  if (token) {
    const tokenValidation = await validateStaffSetPasswordToken(token);

    if (!tokenValidation.ok) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#f5f5f4,_#e7e5e4_45%,_#d6d3d1)] px-4 py-10">
          <div className="w-full max-w-md rounded-[28px] border border-red-200 bg-white/95 p-8 shadow-2xl shadow-neutral-900/10">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-neutral-500">Personel Girisi</p>
            <h1 className="mt-3 text-2xl font-semibold text-neutral-950">Set Password Linki Gecersiz</h1>
            <p className="mt-3 text-sm text-neutral-700">{tokenErrorMessage(tokenValidation.code)}</p>
            <Link
              href="/glidragiris"
              className="mt-6 inline-flex rounded-2xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
            >
              Giris Sayfasina Don
            </Link>
          </div>
        </main>
      );
    }

    const redirectTo = buildTenantLoginPath(tokenValidation.snapshot.tenantSlug);

    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#f5f5f4,_#e7e5e4_45%,_#d6d3d1)] px-4 py-10">
        <SetPasswordForm
          mode="token"
          token={token}
          displayName={formatStaffDisplayName({
            displayName: tokenValidation.snapshot.displayName,
            username: tokenValidation.snapshot.username,
          })}
          redirectTo={redirectTo}
          expiresAt={tokenValidation.snapshot.expiresAt.toISOString()}
        />
      </main>
    );
  }

  const session = await getAuthenticatedAdminSession();
  if (!session?.username || session.tenantId == null) {
    redirect("/glidragiris");
  }

  const staff = await loadTenantStaffForAuth(session.tenantId, session.username);
  if (!staff?.isActive) {
    redirect("/glidragiris?error=inactive");
  }
  if (!staff.mustSetPassword) {
    const target = resolveStaffPostLoginTarget(staff);
    if (target.kind === "redirect") {
      redirect(target.path);
    }
    redirect(`/glidragiris?error=${target.errorCode}`);
  }

  const afterPasswordTarget = resolveStaffPostLoginTarget({
    ...staff,
    mustSetPassword: false,
  });
  const redirectTo =
    afterPasswordTarget.kind === "redirect"
      ? afterPasswordTarget.path
      : `/glidragiris?error=${afterPasswordTarget.errorCode}`;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#f5f5f4,_#e7e5e4_45%,_#d6d3d1)] px-4 py-10">
      <SetPasswordForm
        mode="session"
        displayName={formatStaffDisplayName({
          displayName: staff.displayName,
          username: session.username,
        })}
        redirectTo={redirectTo}
      />
    </main>
  );
}
