import { DesignHeaderNavForm } from "@/modules/hq/components/design/design-header-nav-form";
import { DesignPageIntro } from "@/modules/hq/components/design/design-page-intro";
import { getLandingPublicDesignForHq } from "@/modules/marketing/server/landing-design";

export default async function HqDesignHeaderPage() {
  const { design, updatedAt } = await getLandingPublicDesignForHq();

  return (
    <div className="space-y-6">
      <DesignPageIntro
        title="Üst menü ve CTA"
        description="Masaüstü ve mobil yatay menüdeki öğeler ile sağ üstteki ana düğme. Pasif öğeler sitede gösterilmez. Bağlantılar kayıtta doğrulanır."
      />
      <DesignHeaderNavForm
        key={updatedAt.toISOString()}
        initialNav={design.nav}
        initialHeaderCta={design.headerBarCta}
      />
    </div>
  );
}
