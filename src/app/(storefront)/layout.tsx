import { prisma } from "@/lib/prisma";
import {
  getCurrentTenantOrThrow,
  runWithTenantContext,
} from "@/lib/tenancy/context";

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { tenantId, slug } = await getCurrentTenantOrThrow();

  const restaurant = await prisma.restaurant.findFirst({
    where: { tenantId },
  });

  // Not: rendering hatalarını try/catch ile yakalamak yerine,
  // Next.js error boundary mekanizması kullanılmalıdır.
  if (!restaurant) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        Tenant için restoran bulunamadı.
      </div>
    );
  }

  return runWithTenantContext({ tenantId, slug }, () => <>{children}</>);
}
