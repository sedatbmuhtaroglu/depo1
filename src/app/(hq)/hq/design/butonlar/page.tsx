import { DesignHeroButtonsForm } from "@/modules/hq/components/design/design-hero-buttons-form";
import { DesignPageIntro } from "@/modules/hq/components/design/design-page-intro";
import { getLandingPublicDesignForHq } from "@/modules/marketing/server/landing-design";

export default async function HqDesignButtonsPage() {
  const { design, updatedAt } = await getLandingPublicDesignForHq();

  return (
    <div className="space-y-6">
      <DesignPageIntro
        title="Hero butonları"
        description="Sayfanın üst bölümündeki birincil ve ikincil çağrı düğmeleri. İsterseniz birini gizleyebilirsiniz; metin ve hedef bağlantı buradan güncellenir."
      />
      <DesignHeroButtonsForm
        key={updatedAt.toISOString()}
        primary={design.heroPrimary}
        secondary={design.heroSecondary}
      />
    </div>
  );
}
