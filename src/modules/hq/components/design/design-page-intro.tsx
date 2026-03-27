import { cardClasses } from "@/lib/ui/button-variants";

type DesignPageIntroProps = {
  title: string;
  description: string;
};

export function DesignPageIntro({ title, description }: DesignPageIntroProps) {
  return (
    <div className={cardClasses({ className: "border border-[var(--ui-border-subtle)] p-4 sm:p-5" })}>
      <h2 className="text-lg font-semibold text-[var(--ui-text-primary)]">{title}</h2>
      <p className="mt-1 text-sm leading-relaxed text-[var(--ui-text-secondary)]">{description}</p>
    </div>
  );
}
