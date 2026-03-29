"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { PanelSelect } from "@/components/ui/panel-select";
import { labelClasses } from "@/lib/ui/button-variants";

export function ShowcaseMenuToolbar({
  menus,
  selectedMenuId,
}: {
  menus: Array<{ id: number; name: string; isActive: boolean }>;
  selectedMenuId: number | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <div className="max-w-md">
      <label className={labelClasses("text-xs")}>Düzenlenen menü</label>
      <PanelSelect
        value={selectedMenuId === null ? "" : String(selectedMenuId)}
        onValueChange={(next) => {
          const params = new URLSearchParams(searchParams.toString());
          if (!next) params.delete("menuId");
          else params.set("menuId", next);
          const q = params.toString();
          router.push(q ? `${pathname}?${q}` : pathname);
        }}
        aria-label="Vitrin için menü seçimi"
        options={[
          { value: "", label: "Menü seçin…" },
          ...menus.map((m) => ({
            value: m.id,
            label: `${m.name}${m.isActive ? " · aktif" : ""}`,
          })),
        ]}
      />
    </div>
  );
}
