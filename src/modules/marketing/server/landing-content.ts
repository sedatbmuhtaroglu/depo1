import { prisma } from "@/lib/prisma";
import { unstable_noStore as noStore } from "next/cache";

const MAIN_SITE_KEY = "main";

const DEFAULT_MARKETING_SITE_CREATE = {
  key: MAIN_SITE_KEY,
  isPublished: true,
  brandName: "MENUCY",
  brandTagline: "Yeni Nesil QR Menü ve Sipariş Yönetim Platformu",
  announcementEnabled: true,
  announcementText: "Operasyonunuzu hızlandırın: Temassız sipariş, dijital ödeme ve mutfak yönetimi tek panelde.",
  announcementCtaLabel: "Ücretsiz QR Menü Oluştur",
  announcementCtaHref: "#lead-form",
  heroKicker: "Restoranlar İçin Premium Dijital Deneyim",
  heroTitle: "Sıradan bir menü değil, satışları artıran bir operasyon motoru.",
  heroDescription:
    "MENUCY; müşteri, garson ve mutfak akışlarını kusursuz bir hibrit operasyonda birleştirir. Hız kazanın, maliyetleri düşürün ve misafirlerinize modern bir deneyim sunun.",
  heroPrimaryCtaLabel: "QR Menü Oluştur",
  heroPrimaryCtaHref: "#lead-form",
  heroSecondaryCtaLabel: "Özellikleri İncele",
  heroSecondaryCtaHref: "#features",
  trustSectionTitle: "Güvenle Kullanan Ekipler",
  trustSectionDescription: "Sahada hız, netlik ve tam kontrol arayan profesyonel işletmeler.",
  featuresSectionTitle: "Operasyonunuzu Güçlendiren Yetenekler",
  featuresSectionDescription: "Sipariş hattındaki darboğazları ortadan kaldırmak için özel olarak tasarlandı.",
  howItWorksSectionTitle: "Nasıl Çalışır?",
  howItWorksSectionDescription: "Kurulumdan canlıya geçişe kadar her adımda yanınızdayız.",
  categorySectionTitle: "İşletmenize Özel Çözümler",
  categorySectionDescription: "Farklı servis modelleri ve ekip ihtiyaçları için optimize edilmiş akışlar.",
  ctaSectionTitle: "Restoranınız için en doğru dijital akışı birlikte kuralim.",
  ctaSectionDescription: "Kısa bir demo ile mevcut operasyonunuzdaki verimsizlikleri belirleyelim.",
  ctaPrimaryLabel: "Hemen Başlayın",
  ctaPrimaryHref: "#lead-form",
  faqSectionTitle: "Sıkça Sorulan Sorular",
  faqSectionDescription: "Karar sürecinde size yardımcı olacak temel bilgiler.",
  formSectionTitle: "Uzman Ekibimiz Sizi Arasın",
  formSectionDescription: "Formu doldurun; işletmenize en uygun paketi ve kurulum planını birlikte netleştirelim.",
  formSubmitLabel: "Bilgi Almak İstiyorum",
  formConsentText: "Verilerimin satış ekibiyle iletişime geçilmesi amacıyla kullanılmasını onaylıyorum.",
  seoTitle: "MENUCY | Premium QR Menü ve Restoran Otomasyon Sistemi",
  seoDescription:
    "MENUCY ile restoranınızda dijital sipariş, mutfak yönetimi ve detaylı raporlama ile operasyonel mükemmelliğe ulaşın.",
  seoCanonicalUrl: "https://www.menucy.com/",
  seoOgTitle: "MENUCY ile QR Menü ve Sipariş Yönetimini Modernleştirin",
  seoOgDescription:
    "Masa başı QR deneyimi, garson paneli ve mutfak akışıyla satışlarınızı ve verimliliğinizi artırın.",
  seoOgImageUrl: null,
} as const;

type MarketingSiteWithAllRelations = Awaited<ReturnType<typeof getMarketingSiteConfigForHq>>;
type MarketingSiteRecord = NonNullable<MarketingSiteWithAllRelations>;

export async function ensureMainMarketingSiteId(): Promise<number> {
  const site = await prisma.marketingSiteConfig.upsert({
    where: { key: MAIN_SITE_KEY },
    update: {},
    create: {
      ...DEFAULT_MARKETING_SITE_CREATE,
      trustBadges: {
        create: [
          {
            label: "Canli Operasyon Odakli",
            sublabel: "Masa akisini bozmadan dijitallesme",
            sortOrder: 1,
          },
          {
            label: "Mobil Once Deneyim",
            sublabel: "Musteri ve ekip ekranlari mobil hizinda",
            sortOrder: 2,
          },
          {
            label: "HQ Merkez Yonetim",
            sublabel: "Lead, tenant ve icerik tek panelde",
            sortOrder: 3,
          },
        ],
      },
      logos: {
        create: [
          { name: "Demo Restoran A", logoUrl: "https://placehold.co/120x40?text=A", sortOrder: 1 },
          { name: "Demo Restoran B", logoUrl: "https://placehold.co/120x40?text=B", sortOrder: 2 },
          { name: "Demo Restoran C", logoUrl: "https://placehold.co/120x40?text=C", sortOrder: 3 },
        ],
      },
      features: {
        create: [
          {
            title: "QR Menu + Siparis",
            description: "Musteri menuyu acip garson beklemeden siparis surecini baslatir.",
            sortOrder: 1,
          },
          {
            title: "Garson ve Mutfak Gorunurlugu",
            description: "Siparis yasam dongusu sahadaki ekiplere net gorunur.",
            sortOrder: 2,
          },
          {
            title: "Merkezi HQ Kontrolu",
            description: "Lead, tenant ve ticari akis ayni merkezden yonetilir.",
            sortOrder: 3,
          },
        ],
      },
      howItWorks: {
        create: [
          {
            title: "1) Kisa On Analiz",
            description: "Restoran tipinize ve masa akisiniza uygun kurulum plani belirlenir.",
            sortOrder: 1,
          },
          {
            title: "2) Hizli Kurulum",
            description: "Menu ve operasyon ayarlariyla canli test ortami acilir.",
            sortOrder: 2,
          },
          {
            title: "3) Canliya Gecis",
            description: "Ekip onboarding'i tamamlanir ve operasyon aktif kullanima alinir.",
            sortOrder: 3,
          },
        ],
      },
      categories: {
        create: [
          {
            slug: "hizli-servis",
            title: "Hizli Servis",
            description: "Sirkulasyon hizli, masa devri kritik operasyonlar.",
            sortOrder: 1,
            subcategories: {
              create: [
                {
                  slug: "self-order",
                  title: "Self-Order Akisi",
                  description: "Musteri siparisi masadan dogrudan olusturur.",
                  sortOrder: 1,
                },
              ],
            },
          },
          {
            slug: "servis-restorani",
            title: "Servis Restorani",
            description: "Garson ve mutfak koordinasyonunun onemli oldugu yapilar.",
            sortOrder: 2,
            subcategories: {
              create: [
                {
                  slug: "garson-cagri",
                  title: "Garson Cagri ve Takip",
                  description: "Masa talepleri kayitli ve izlenebilir akisa donusur.",
                  sortOrder: 1,
                },
              ],
            },
          },
        ],
      },
      faqs: {
        create: [
          {
            question: "Kurulum ne kadar surer?",
            answer: "Standart senaryoda temel kurulum ayni gun icinde tamamlanabilir.",
            sortOrder: 1,
          },
          {
            question: "Mevcut menumu tasiyabilir miyim?",
            answer: "Evet. Menu yapisi MENUCY paneline hizli bir sekilde aktarilabilir.",
            sortOrder: 2,
          },
        ],
      },
    },
    select: { id: true },
  });

  return site.id;
}

export async function getMarketingSiteConfigForHq() {
  noStore();
  const siteId = await ensureMainMarketingSiteId();
  return prisma.marketingSiteConfig.findUnique({
    where: { id: siteId },
    include: {
      trustBadges: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      logos: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      features: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      howItWorks: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      categories: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: {
          subcategories: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
        },
      },
      faqs: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      landingTheme: true,
      landingSections: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
      landingNavItems: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        include: {
          subitems: { orderBy: [{ sortOrder: "asc" }, { id: "asc" }] },
        },
      },
    },
  });
}

export async function getMarketingSiteConfigForPublic() {
  noStore();
  const site = await getMarketingSiteConfigForHq();
  if (!site) return null;
  if (!site.isPublished) return null;

  return {
    ...site,
    trustBadges: site.trustBadges.filter((item) => item.isEnabled),
    logos: site.logos.filter((item) => item.isEnabled),
    features: site.features.filter((item) => item.isEnabled),
    howItWorks: site.howItWorks.filter((item) => item.isEnabled),
    categories: site.categories
      .filter((item) => item.isEnabled)
      .map((category) => ({
        ...category,
        subcategories: category.subcategories.filter((item) => item.isEnabled),
      })),
    faqs: site.faqs.filter((item) => item.isEnabled),
    landingSections: site.landingSections.filter((item) => item.isEnabled),
    landingNavItems: site.landingNavItems
      .filter((item) => item.isActive)
      .map((item) => ({
        ...item,
        subitems: item.subitems.filter((sub) => sub.isActive),
      })),
  };
}

export type MarketingLandingPublicData = Awaited<
  ReturnType<typeof getMarketingSiteConfigForPublic>
>;
export type MarketingLandingHqData = MarketingSiteRecord;
