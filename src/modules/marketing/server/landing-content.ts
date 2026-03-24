import { prisma } from "@/lib/prisma";

const MAIN_SITE_KEY = "main";

const DEFAULT_MARKETING_SITE_CREATE = {
  key: MAIN_SITE_KEY,
  isPublished: true,
  brandName: "MENUCY",
  brandTagline: "QR menu ve siparis operasyonunu hizlandiran restoran platformu",
  announcementEnabled: true,
  announcementText: "Yeni nesil restoran akisi: menu, siparis, odeme ve servis tek panelde.",
  announcementCtaLabel: "Demo Talep Et",
  announcementCtaHref: "#lead-form",
  heroKicker: "Restoranlar Icin Satisa Donusen Dijital Deneyim",
  heroTitle: "Masaya gelen QR ile siparis surecini hizlandirin, satisi buyutun.",
  heroDescription:
    "MENUCY; musteri deneyimini, garson operasyonunu ve mutfak gorunurlugunu tek bir akista birlestirir.",
  heroPrimaryCtaLabel: "Hemen Demo Al",
  heroPrimaryCtaHref: "#lead-form",
  heroSecondaryCtaLabel: "Ozellikleri Incele",
  heroSecondaryCtaHref: "#features",
  trustSectionTitle: "Tercih Eden Ekipler",
  trustSectionDescription: "Sahada hiz, netlik ve kontrol arayan restoran operasyonlari.",
  featuresSectionTitle: "Operasyonu Hızlandıran Yetenekler",
  featuresSectionDescription: "Siparis hattini yavaslatan noktalari azaltmak icin tasarlandi.",
  howItWorksSectionTitle: "Nasil Calisir",
  howItWorksSectionDescription: "Kurulumdan canliya gecise kadar sade bir akis.",
  categorySectionTitle: "Kullanim Alanlari",
  categorySectionDescription: "Farkli restoran tipleri ve ekip ihtiyaclari icin net paketler.",
  ctaSectionTitle: "Restoraniniz icin en dogru akisi birlikte kuralim.",
  ctaSectionDescription: "Kisa bir demo ile mevcut operasyonunuza uygun plani netlestirelim.",
  ctaPrimaryLabel: "Demo Randevusu Al",
  ctaPrimaryHref: "#lead-form",
  faqSectionTitle: "Sik Sorulan Sorular",
  faqSectionDescription: "Karar surecinde en cok gelen sorular.",
  formSectionTitle: "Satis Ekibi Sizi Arasin",
  formSectionDescription: "Kisa bir form doldurun, en uygun paketi birlikte belirleyelim.",
  formSubmitLabel: "Basvuru Gonder",
  formConsentText: "Bilgilerimin satis ekibiyle iletisim icin kullanilmasini kabul ediyorum.",
  seoTitle: "MENUCY | QR Menu ve Restoran Siparis Platformu",
  seoDescription:
    "MENUCY ile restoran operasyonunda hiz, gorunurluk ve satis odakli dijital deneyim elde edin.",
  seoCanonicalUrl: "https://www.menucy.com/",
  seoOgTitle: "MENUCY ile QR Menu ve Siparis Operasyonunu Buyutun",
  seoOgDescription:
    "Masa QR deneyimi, garson paneli ve mutfak akisiyla restoran operasyonunu modernlestirin.",
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
    },
  });
}

export async function getMarketingSiteConfigForPublic() {
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
  };
}

export type MarketingLandingPublicData = Awaited<
  ReturnType<typeof getMarketingSiteConfigForPublic>
>;
export type MarketingLandingHqData = MarketingSiteRecord;
