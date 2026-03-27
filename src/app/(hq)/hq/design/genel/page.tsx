import { DesignGeneralForm } from "@/modules/hq/components/design/design-general-form";
import { DesignPageIntro } from "@/modules/hq/components/design/design-page-intro";
import { getLandingPublicDesignForHq } from "@/modules/marketing/server/landing-design";

export default async function HqDesignGeneralPage() {
  const { design, updatedAt } = await getLandingPublicDesignForHq();

  return (
    <div className="space-y-6">
      <DesignPageIntro
        title="Marka ve genel"
        description="Ziyaretçilerin üst çubukta gördüğü marka adı ve kısa slogan. Blog ve içerik sayfalarında marka adı da bu ayarlarla uyumludur."
      />
      <DesignGeneralForm key={updatedAt.toISOString()} initial={design.general} />
    </div>
  );
}
