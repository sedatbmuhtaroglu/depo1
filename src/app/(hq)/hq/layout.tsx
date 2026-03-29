import { requireHqSession } from "@/lib/auth";
import { HqShell } from "@/modules/hq/components/hq-shell";

export default async function HqLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireHqSession();

  return <HqShell username={session.username}>{children}</HqShell>;
}
