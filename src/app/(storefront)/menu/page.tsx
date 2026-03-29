import type { Metadata } from "next";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { getStorefrontPublicMenuData } from "@/lib/storefront-public-menu-data";
import type { StorefrontPublicMenuData } from "@/lib/storefront-public-menu-data";
import { parseTenantResolutionCode } from "@/lib/tenancy/tenant-resolution-error";
import { TenantResolutionError } from "@/lib/tenancy/tenant-resolution-error";
import { resolveTenantSlugFromHostname } from "@/lib/tenancy/resolve";
import PublicMenuClient from "./public-menu-client";

export const dynamic = "force-dynamic";

function resolveRequestHostname(h: { get(name: string): string | null }): string {
  const raw = h.get("host") ?? h.get("x-forwarded-host") ?? "";
  const host = raw.split(",")[0]?.trim().toLowerCase() ?? "";
  return host.replace(/:\d+$/, "");
}

async function resolveTenantForMenuFromHost(
  h: { get(name: string): string | null },
): Promise<{ tenantId: number } | null> {
  const hostname = resolveRequestHostname(h);
  const slugFromHost = resolveTenantSlugFromHostname(hostname);
  if (!slugFromHost) {
    return null;
  }
  const tenant = await prisma.tenant.findUnique({
    where: { slug: slugFromHost },
    select: { id: true },
  });
  if (!tenant) {
    throw new TenantResolutionError("TENANT_NOT_FOUND");
  }
  return { tenantId: tenant.id };
}

function getDemoMenuData(): StorefrontPublicMenuData {
  return {
    restaurant: {
      id: 0,
      name: "Catal App Demo Restoran",
      logoUrl: null,
      themeColor: "primary",
      menuFontSizePx: null,
      menuTextColor: null,
      menuBackgroundColor: null,
      menuButtonBackgroundColor: null,
      menuHeaderBackgroundColor: null,
      openingHour: "10:00",
      closingHour: "22:00",
      orderingClosed: false,
      menuComplianceVisible: true,
      orderingFeatureEnabled: false,
    },
    hasPublishedMenu: true,
    categories: [
      {
        id: 1,
        nameTR: "Baslangiclar",
        nameEN: "Starters",
        products: [
          {
            id: 101,
            categoryId: 1,
            nameTR: "Mercimek Corbasi",
            nameEN: "Lentil Soup",
            descriptionTR: "Gunun sicak corbasi",
            descriptionEN: "Daily warm soup",
            price: 95,
            imageUrl: null,
            isAvailable: true,
            trackStock: false,
            stockQuantity: 0,
            complianceInfo: {
              basicIngredients: "Mercimek, sogan, baharat",
              caloriesKcal: 220,
              allergens: null,
              customAllergens: null,
              alcoholStatus: "NO",
              porkStatus: "NO",
              crossContaminationNote: null,
            },
          },
        ],
      },
      {
        id: 2,
        nameTR: "Ana Yemekler",
        nameEN: "Main Dishes",
        products: [
          {
            id: 201,
            categoryId: 2,
            nameTR: "Izgara Kofte",
            nameEN: "Grilled Meatballs",
            descriptionTR: "Pilav ve izgara sebze ile servis edilir",
            descriptionEN: "Served with rice and grilled vegetables",
            price: 245,
            imageUrl: null,
            isAvailable: true,
            trackStock: false,
            stockQuantity: 0,
            complianceInfo: {
              basicIngredients: "Dana eti, baharat, pirinc",
              caloriesKcal: 680,
              allergens: null,
              customAllergens: null,
              alcoholStatus: "NO",
              porkStatus: "NO",
              crossContaminationNote: "Ayni mutfakta glutenli urunler bulunabilir.",
            },
          },
          {
            id: 202,
            categoryId: 2,
            nameTR: "Tavuk Izgara",
            nameEN: "Grilled Chicken",
            descriptionTR: "Izgara tavuk gogsu, salata ile",
            descriptionEN: "Grilled chicken breast with salad",
            price: 215,
            imageUrl: null,
            isAvailable: true,
            trackStock: false,
            stockQuantity: 0,
            complianceInfo: null,
          },
        ],
      },
    ],
  };
}

export async function generateMetadata(): Promise<Metadata> {
  const h = await headers();
  if (resolveRequestHostname(h) === "localhost") {
    return {
      title: "Demo Menü | Catal App",
      description: "Local demo menusu",
    };
  }

  try {
    const resolved = await resolveTenantForMenuFromHost(h);
    if (!resolved) {
      return {
        title: "Menü | Catal App",
        description: "Restoran menusu",
      };
    }
    const data = await getStorefrontPublicMenuData({ tenantId: resolved.tenantId });
    const restaurantName = data?.restaurant.name ?? "Catal App";
    return {
      title: `${restaurantName} | Menü`,
      description: `${restaurantName} restoraninin aktif menusu`,
    };
  } catch {
    return {
      title: "Menü | Catal App",
      description: "Restoran menusu",
    };
  }
}

export default async function StorefrontPublicMenuPage() {
  const h = await headers();
  const isPlainLocalhost = resolveRequestHostname(h) === "localhost";

  let data: StorefrontPublicMenuData | null = null;
  try {
    const resolved = await resolveTenantForMenuFromHost(h);
    if (!resolved) {
      if (isPlainLocalhost) {
        return <PublicMenuClient data={getDemoMenuData()} />;
      }
      throw new TenantResolutionError("TENANT_NOT_FOUND");
    }
    data = await getStorefrontPublicMenuData({ tenantId: resolved.tenantId });
  } catch (error) {
    const tenantCode = parseTenantResolutionCode(error);
    if (isPlainLocalhost && tenantCode === "TENANT_NOT_FOUND") {
      return <PublicMenuClient data={getDemoMenuData()} />;
    }
    throw error;
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-center text-slate-100">
        Restoran bilgisi bulunamadı.
      </div>
    );
  }

  return <PublicMenuClient data={data} />;
}
