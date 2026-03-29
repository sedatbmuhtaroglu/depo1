import Link from "next/link";
import { Palette, Paintbrush, PanelTop, MousePointerClick, Building2, CircleDollarSign } from "lucide-react";
import { cardClasses } from "@/lib/ui/button-variants";

const CARDS = [
  {
    href: "/hq/design/genel",
    title: "Marka ve genel",
    body: "Üst çubukta görünen marka adı, slogan ve görünürlük ayarları.",
    icon: Building2,
  },
  {
    href: "/hq/design/renkler",
    title: "Renkler",
    body: "Birincil ve çerçeveli buton renkleri; canlı önizleme ile.",
    icon: Paintbrush,
  },
  {
    href: "/hq/design/header",
    title: "Üst menü ve CTA",
    body: "Gezinme öğeleri (metin, bağlantı, sıra, yayın) ve sağ üst CTA.",
    icon: PanelTop,
  },
  {
    href: "/hq/design/butonlar",
    title: "Hero butonları",
    body: "Kahraman bölümündeki birincil ve ikincil çağrı metinleri ve bağlantıları.",
    icon: MousePointerClick,
  },
  {
    href: "/hq/design/fiyatlandirma",
    title: "Fiyatlandırma",
    body: "Paket kartları, başlıklar, özellik listeleri ve önerilen paket rozeti.",
    icon: CircleDollarSign,
  },
] as const;

export default function HqDesignOverviewPage() {
  return (
    <div className="space-y-6">
      <div className={cardClasses({ className: "border border-[var(--ui-border-subtle)] p-5 sm:p-6" })}>
        <div className="flex flex-wrap items-start gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--ui-primary-soft)] text-[var(--ui-accent)]">
            <Palette className="h-5 w-5" strokeWidth={1.75} />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="text-xl font-semibold text-[var(--ui-text-primary)]">Landing tasarım ayarları</h1>
            <p className="text-sm leading-relaxed text-[var(--ui-text-secondary)]">
              Public ana sayfa (<code className="rounded bg-[var(--ui-surface-subtle)] px-1 text-xs">/</code>) üst
              menüsü, CTA metinleri ve buton renkleri buradan yönetilir. Değişiklikler kaydedildikten sonra ana sayfada
              görünür.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((c) => {
          const Icon = c.icon;
          return (
            <Link
              key={c.href}
              href={c.href}
              className={cardClasses({
                className:
                  "group block border border-[var(--ui-border-subtle)] p-5 transition-shadow hover:shadow-md",
              })}
            >
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[var(--ui-surface-subtle)] text-[var(--ui-accent)] group-hover:bg-[var(--ui-primary-soft)]">
                  <Icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
                <div>
                  <h2 className="font-semibold text-[var(--ui-text-primary)]">{c.title}</h2>
                  <p className="mt-1 text-sm text-[var(--ui-text-secondary)]">{c.body}</p>
                  <span className="mt-2 inline-block text-sm font-medium text-[var(--ui-accent)]">Aç →</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
