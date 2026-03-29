import { DesignPageIntro } from "@/modules/hq/components/design/design-page-intro";
import { DesignPricingForm } from "@/modules/hq/components/design/design-pricing-form";
import { getLandingPublicDesignForHq } from "@/modules/marketing/server/landing-design";

export default async function HqDesignPricingPage() {
  const { design, updatedAt } = await getLandingPublicDesignForHq();

  return (
    <div className="space-y-6">
      <DesignPageIntro
        title="Fiyatlandırma bölümü"
        description="Paket kartları, aylık/yıllık fiyat satırları ve CTA’lar. Seçiciyi kapatarak yalnızca aylık fiyat gösterebilirsiniz. Bölüm kimliği üst menüdeki #anchor ile uyumlu olmalıdır."
      />
      <DesignPricingForm key={updatedAt.toISOString()} initial={design.pricing} />
    </div>
  );
}
