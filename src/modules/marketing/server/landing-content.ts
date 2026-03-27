import { prisma } from "@/lib/prisma";
import { unstable_noStore as noStore } from "next/cache";

const MAIN_SITE_KEY = "main";

const DEFAULT_MARKETING_SITE_CREATE = {
  key: MAIN_SITE_KEY,
  isPublished: true,
  brandName: "Catal App",
  brandTagline: "QR menü ve masadan sipariş — tek panelden yönetim",
  announcementEnabled: true,
  announcementText:
    "Baskı maliyetini azaltın, menüyü anında güncelleyin; temassız sipariş ve mutfak akışı aynı yerde.",
  announcementCtaLabel: "Ücretsiz bilgi al",
  announcementCtaHref: "#lead-form",
  heroKicker: "Restoran ve kafe işletmeleri için QR menü",
  heroTitle: "QR menü ve masadan sipariş — dakikalar içinde kurulum, anında güncellenen menü.",
  heroDescription:
    "Misafir masadan menüye erişir ve sipariş verir; siz menüyü tek yerden güncellersiniz, servis akışı düzenli kalır.",
  heroPrimaryCtaLabel: "Ücretsiz bilgi al",
  heroPrimaryCtaHref: "#lead-form",
  heroSecondaryCtaLabel: "Özellikleri incele",
  heroSecondaryCtaHref: "#features",
  trustSectionTitle: "Sahada sakin, merkezde kontrol",
  trustSectionDescription:
    "Hızlı kurulum, çoklu dil menü ve merkezi yönetim aynı çatı altında; ekip sahada sakin kalır.",
  featuresSectionTitle: "Somut işletme faydaları",
  featuresSectionDescription:
    "Baskıdan çoklu dile, masadan siparişten merkezi kontrole: somut işletme faydası, kısa ve net anlatım.",
  howItWorksSectionTitle: "Nasıl çalışır?",
  howItWorksSectionDescription:
    "Üç adımda net: masa düzeni ve menü hazır, QR ve test tamam, misafir akışı başlar.",
  categorySectionTitle: "Kullanım alanları",
  categorySectionDescription:
    "Servis modelinize göre doğru akış; hızlı masa devri veya güçlü garson koordinasyonu.",
  ctaSectionTitle: "QR menünüzü bugün konuşalım, yarın masada kullanın",
  ctaSectionDescription:
    "Kısa bir görüşmede işletme tipinize uygun paketi ve kurulumu netleştiriyoruz; beklemeden başlayın.",
  ctaPrimaryLabel: "Bilgi al",
  ctaPrimaryHref: "#lead-form",
  faqSectionTitle: "Sıkça sorulan sorular",
  faqSectionDescription: "Karar verirken ihtiyaç duyacağınız net yanıtlar.",
  formSectionTitle: "Size en uygun paketi birlikte seçelim",
  formSectionDescription:
    "Kısa formu doldurun; masa düzeninize ve ekip yapınıza uygun kurulumu netleştirelim.",
  formSubmitLabel: "Bilgi almak istiyorum",
  formConsentText: "Verilerimin satış ekibiyle iletişime geçilmesi amacıyla kullanılmasını onaylıyorum.",
  seoTitle: "Catal App | QR menü ve masadan sipariş platformu",
  seoDescription:
    "QR menü, çoklu dil, masadan sipariş ve mutfak entegrasyonu — baskı ve güncellik maliyetini düşürün, operasyonu hızlandırın.",
  seoCanonicalUrl: "https://www.menucy.com/",
  seoOgTitle: "Catal App — QR menü ve operasyon tek panelde",
  seoOgDescription:
    "Misafir masadan sipariş verir; garson, mutfak ve yönetim aynı akışta kalır.",
  seoOgImageUrl: null,
} as const;

/** Lead form ve FK için ana marketing site satırı; canlı landing metni `src/content/landing.ts` içindedir. */
export async function ensureMainMarketingSiteId(): Promise<number> {
  const site = await prisma.marketingSiteConfig.upsert({
    where: { key: MAIN_SITE_KEY },
    update: {},
    create: {
      ...DEFAULT_MARKETING_SITE_CREATE,
      trustBadges: {
        create: [
          {
            label: "Hızlı kurulum",
            sublabel: "Menü ve akış dakikalar içinde hazır",
            sortOrder: 1,
          },
          {
            label: "Çoklu dil menü",
            sublabel: "Misafire göre dil, tek merkezden yönetim",
            sortOrder: 2,
          },
          {
            label: "Merkezi kontrol",
            sublabel: "Şube ve içerik tek panelde",
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
            title: "Masadan sipariş ile hız kazanın",
            description:
              "Misafir QR ile menüye erişir; sipariş düzenli mutfağa düşer, servis hızlanır.",
            sortOrder: 1,
          },
          {
            title: "Garson ve mutfak akışını netleştirin",
            description:
              "Masa talepleri kayıt altında kalır; mutfak ve salon aynı ritimde çalışır.",
            sortOrder: 2,
          },
          {
            title: "Merkezi kontrol, tek panel",
            description:
              "Şube ve menüyü tek yerden yönetin; raporu ve güncellemeyi aynı ekrandan izleyin.",
            sortOrder: 3,
          },
        ],
      },
      howItWorks: {
        create: [
          {
            title: "1) Menü ve masa yapısı hazırlanır",
            description:
              "İşletme düzeninize uygun menü içeriği ve masa yapısı birlikte oluşturulur.",
            sortOrder: 1,
          },
          {
            title: "2) QR yerleştirilir, sistem test edilir",
            description:
              "QR kodlar masalara yerleştirilir; sipariş akışı kısa bir testle doğrulanır.",
            sortOrder: 2,
          },
          {
            title: "3) Misafir menüye erişir, akış başlar",
            description:
              "Müşteri menüyü açar; masadan sipariş süreci kontrollü şekilde devreye girer.",
            sortOrder: 3,
          },
        ],
      },
      categories: {
        create: [
          {
            slug: "hizli-servis",
            title: "Hızlı servis ve kafe",
            description:
              "Masa devri yüksek yerlerde siparişi hızlandırır; menü güncelliği baskı maliyetini düşürür.",
            sortOrder: 1,
            subcategories: {
              create: [
                {
                  slug: "self-order",
                  title: "Masadan sipariş",
                  description: "Misafir QR ile menüyü açar, siparişi doğrudan iletir.",
                  sortOrder: 1,
                },
              ],
            },
          },
          {
            slug: "servis-restorani",
            title: "Tam servis restoran",
            description:
              "Garson ve mutfak uyumu kritikse talepler kayıt altında kalır, koordinasyon netleşir.",
            sortOrder: 2,
            subcategories: {
              create: [
                {
                  slug: "garson-cagri",
                  title: "Garson çağrısı ve takip",
                  description: "Masa istekleri tek ekranda; gecikme ve kaçan talepler azalır.",
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
            question: "Kurulum ne kadar sürer?",
            answer:
              "Temel kurulum çoğu işletmede aynı gün içinde tamamlanır; menü içeriği hazırsa süre daha da kısalır.",
            sortOrder: 1,
          },
          {
            question: "Mevcut menümü taşıyabilir miyim?",
            answer: "Evet. Menü yapınızı panele aktararak hızlıca canlıya alabilirsiniz.",
            sortOrder: 2,
          },
        ],
      },
    },
    select: { id: true },
  });

  return site.id;
}

export async function getMainMarketingSiteSummaryForHq() {
  noStore();
  await ensureMainMarketingSiteId();
  return prisma.marketingSiteConfig.findUnique({
    where: { key: MAIN_SITE_KEY },
    select: {
      id: true,
      isPublished: true,
      updatedAt: true,
      brandName: true,
    },
  });
}
