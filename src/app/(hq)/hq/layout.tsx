import { requireHqSession } from "@/lib/auth";
import AdminLogoutButton from "@/components/admin-logout-button";
import { buttonClasses } from "@/lib/ui/button-variants";
import { HqSideNav } from "@/modules/hq/components/hq-side-nav";

export default async function HqLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireHqSession();

  return (
    <div className="hq-scope min-h-screen bg-[var(--ui-bg-canvas)]">
      <header className="border-b border-[var(--ui-border)] bg-[var(--ui-surface)]">
        <div className="mx-auto flex w-full max-w-[1400px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ui-text-secondary)]">
              ?atal App Main Brain
            </p>
            <h1 className="text-lg font-semibold text-[var(--ui-text-primary)]">
              HQ Kontrol Paneli
            </h1>
            <p className="text-xs text-[var(--ui-text-secondary)]">
              Giris: {session.username}
            </p>
          </div>
          <AdminLogoutButton
            className={buttonClasses({
              variant: "outline",
              className: "px-3",
            })}
          />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:px-8">
        <aside className="lg:w-[230px]">
          <HqSideNav />
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
