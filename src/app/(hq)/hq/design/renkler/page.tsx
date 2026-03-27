import { DesignColorsForm } from "@/modules/hq/components/design/design-colors-form";
import { DesignPageIntro } from "@/modules/hq/components/design/design-page-intro";
import { getLandingPublicDesignForHq } from "@/modules/marketing/server/landing-design";

export default async function HqDesignColorsPage() {
  const { design, updatedAt } = await getLandingPublicDesignForHq();

  return (
    <div className="space-y-6">
      <DesignPageIntro
        title="Renkler"
        description="Ana sayfadaki birincil (dolu) ve ikincil (çerçeveli) butonların renkleri. Yalnızca geçerli 6 haneli hex (#rrggbb) değerleri kabul edilir."
      />
      <DesignColorsForm key={updatedAt.toISOString()} initial={design.colors} />
    </div>
  );
}
