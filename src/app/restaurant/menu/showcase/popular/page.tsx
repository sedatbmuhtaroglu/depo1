import PopularShowcaseManager from "../_components/popular-showcase-manager";
import { getShowcaseAdminData } from "../_lib/load-showcase-admin-data";

export const dynamic = "force-dynamic";

export default async function PopularShowcasePage({
  searchParams,
}: {
  searchParams?: Promise<{ menuId?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const data = await getShowcaseAdminData({ menuId: sp.menuId });

  return (
    <PopularShowcaseManager
      menus={data.menus}
      selectedMenuId={data.selectedMenuId}
      categories={data.showcaseCategories}
      initialPopular={data.popularInitial}
    />
  );
}
