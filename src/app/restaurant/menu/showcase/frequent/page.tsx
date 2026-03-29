import FrequentShowcaseManager from "../_components/frequent-showcase-manager";
import { getShowcaseAdminData } from "../_lib/load-showcase-admin-data";

export const dynamic = "force-dynamic";

export default async function FrequentShowcasePage({
  searchParams,
}: {
  searchParams?: Promise<{ menuId?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const data = await getShowcaseAdminData({ menuId: sp.menuId });

  return (
    <FrequentShowcaseManager
      menus={data.menus}
      selectedMenuId={data.selectedMenuId}
      categories={data.showcaseCategories}
      initial={data.frequentInitial}
    />
  );
}
