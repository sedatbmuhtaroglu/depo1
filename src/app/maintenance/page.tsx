import { redirect } from "next/navigation";
import { GlobalMaintenanceScreen } from "@/components/global-maintenance-screen";
import { getActivePlannedMaintenance } from "@/modules/content/server/content-queries";

export default async function MaintenancePage() {
  const maintenance = await getActivePlannedMaintenance();
  if (!maintenance) {
    redirect("/");
  }

  return (
    <GlobalMaintenanceScreen
      startsAt={maintenance.startsAt}
      endsAt={maintenance.endsAt}
      message={maintenance.message}
    />
  );
}
