/**
 * Tek kaynak: public ana sayfa (landing) metinleri ve SEO.
 * Kodda güncellenir; veritabanı/CMS bağımlılığı yok.
 */

export const landingBrand = {
  name: "Catal App",
  tagline: "QR menü ve masadan sipariş — tek panelden operasyon",
} as const;

export const landingSeo = {
  title: "Catal App | QR menü ve masadan sipariş platformu",
  description:
    "Misafir masadan menüye erişir ve sipariş verir; siz menüyü tek yerden güncellersiniz. Garson, mutfak ve yönetim aynı akışta kalır.",
  canonicalUrl: "https://www.menucy.com/",
  ogTitle: "Catal App — QR menü ve operasyon tek panelde",
  ogDescription:
    "Hızlı kurulum, çoklu dil menü, merkezi yönetim. Restoran ve kafe için net, ölçeklenebilir yapı.",
  ogImageUrl: null as string | null,
} as const;

/** Blog / sayfa meta birleşimleri için ortak marka alanları */
export const landingSiteMeta = {
  brandName: landingBrand.name,
  brandTagline: landingBrand.tagline,
  seoDescription: landingSeo.description,
  seoOgImageUrl: landingSeo.ogImageUrl,
} as const;

export const landingNav = [
  { label: "Faydalar", href: "#faydalar" },
  { label: "Nasıl çalışır", href: "#nasil" },
  { label: "Kullanım", href: "#kullanim" },
  { label: "Fiyat", href: "#fiyat" },
  { label: "SSS", href: "#sss" },
] as const;

export const landingHero = {
  eyebrow: "Restoran ve kafe operasyonu",
  title: "QR menü ve masadan sipariş — tek panelde kontrol.",
  description:
    "Misafir masadan menüyü açar, siparişini iletir; mutfak ve salon aynı ritimde çalışır. Menüyü anında güncellersiniz, baskı ve güncellik maliyetini düşürürsünüz.",
  primaryCta: { label: "Ücretsiz bilgi al", href: "#lead-form" },
  secondaryCta: { label: "Nasıl çalışır?", href: "#nasil" },
  trustLine: "Kurulum kısa sürer; ekibiniz eğitim yükü taşımadan kullanır.",
} as const;

export const landingTrustStrip = {
  items: [
    { label: "Hızlı kurulum", hint: "Menü ve akış kısa sürede hazır" },
    { label: "Çoklu dil menü", hint: "Misafire göre dil, tek merkez" },
    { label: "Masadan sipariş", hint: "Düzenli mutfak akışı" },
    { label: "Merkezi yönetim", hint: "Şube ve içerik tek panelde" },
  ],
} as const;

export const landingBenefits = {
  id: "faydalar",
  eyebrow: "İşletmeye fayda",
  title: "Özellik listesi değil, sahada hissedilen sonuçlar",
  description: "Amacımız menüyü dijitale taşımak değil; sipariş ve servis hızını öngörülebilir kılmak.",
  cards: [
    {
      title: "Masadan hızlı sipariş",
      body: "Misafir QR ile menüye erişir; sipariş düzenli şekilde mutfağa düşer, masa devri ve servis hızı artar.",
    },
    {
      title: "Menüyü anında güncelleyin",
      body: "Fiyat, stok ve içerik değişikliği birkaç dakikada yayında. Baskı ve dağıtım maliyetini kesersiniz.",
    },
    {
      title: "Garson ve mutfak netliği",
      body: "Masa talepleri kayıt altında kalır; geciken veya kaçan siparişler azalır, ekip aynı ekrandan izler.",
    },
    {
      title: "Merkezi kontrol",
      body: "Şube ve içerik tek yerden yönetilir; ölçek büyüdükçe yapıyı bozmadan devam edersiniz.",
    },
  ],
} as const;

export const landingHowItWorks = {
  id: "nasil",
  eyebrow: "Nasıl çalışır",
  title: "Üç adımda net başlangıç",
  description: "Karmaşık projeler değil; işletme düzeninize uygun, hızlı devreye alma.",
  steps: [
    {
      step: "1",
      title: "Menü ve masa yapısı",
      body: "İşletme düzeninize uygun menü içeriği ve masa yapısı birlikte oluşturulur.",
    },
    {
      step: "2",
      title: "QR ve test",
      body: "QR kodlar masalara yerleştirilir; sipariş akışı kısa bir testle doğrulanır.",
    },
    {
      step: "3",
      title: "Canlı kullanım",
      body: "Misafir menüyü açar; masadan sipariş süreci kontrollü şekilde devreye girer.",
    },
  ],
} as const;

export const landingUseCases = {
  id: "kullanim",
  eyebrow: "Kullanım alanları",
  title: "Nerede işe yarar?",
  description: "Servis modeline göre doğru akışı kurun; aynı altyapı üzerinde farklı işletme tipleri.",
  cases: [
    {
      title: "Restoran",
      body: "Tam serviste garson ve mutfak koordinasyonu kritikse talepler tek ekranda toplanır.",
    },
    {
      title: "Kafe",
      body: "Yoğun masa devrinde sipariş hızlanır; menü güncelliği baskı yükünü azaltır.",
    },
    {
      title: "Hızlı servis",
      body: "Sıra ve bekleme azalır; sıraya giren siparişler düzenli mutfağa akar.",
    },
    {
      title: "Çoklu şube",
      body: "Standart menü ve merkezi politika ile şubeleri tek çatıdan yönetirsiniz.",
    },
  ],
} as const;

export const landingPricing = {
  id: "fiyat",
  eyebrow: "Fiyatlandırma",
  title: "Şeffaf paketler, ölçeklenebilir yapı",
  description: "İhtiyacınıza göre başlayın; büyüdükçe aynı mimari üzerinde genişleyin.",
  microTrust: ["Hızlı kurulum", "Şeffaf fiyat", "Ölçeklenebilir yapı"],
  plans: [
    {
      name: "Başlangıç",
      price: "Teklif",
      period: "işletmeye göre",
      description: "Tek şube, temel QR menü ve sipariş akışı.",
      features: ["QR menü ve güncelleme", "Masadan sipariş", "Temel operasyon görünürlüğü"],
      cta: { label: "Bilgi al", href: "#lead-form" },
      highlighted: false,
    },
    {
      name: "İşletme",
      price: "Teklif",
      period: "en çok tercih",
      description: "Yoğun salon ve mutfak için güçlü koordinasyon ve çoklu dil.",
      features: ["Çoklu dil menü", "Garson / mutfak ekranları", "Merkezi menü yönetimi", "Öncelikli kurulum desteği"],
      cta: { label: "Görüşme planla", href: "#lead-form" },
      highlighted: true,
      badge: "Önerilen",
    },
    {
      name: "Çoklu şube",
      price: "Teklif",
      period: "kurumsal",
      description: "Birden fazla lokasyon ve merkezi politika için.",
      features: ["Merkezi şube yönetimi", "Raporlama ve kontrol", "Ölçek ve kullanıcı yapısı", "Sözleşmeli destek"],
      cta: { label: "Bizimle iletişime geçin", href: "#lead-form" },
      highlighted: false,
    },
  ],
} as const;

export const landingFaq = {
  id: "sss",
  eyebrow: "SSS",
  title: "Sıkça sorulan sorular",
  description: "Karar verirken netleşmeniz için kısa yanıtlar.",
  items: [
    {
      q: "Kurulum ne kadar sürer?",
      a: "Menü içeriği hazırsa çoğu işletmede temel kurulum aynı gün içinde tamamlanır. Kapsam büyüdükçe plan birlikte netleştirilir.",
    },
    {
      q: "Mevcut menümü taşıyabilir miyim?",
      a: "Evet. Menü yapınızı panele aktararak hızlıca canlıya alabilirsiniz; güncellemeleri sonra kendiniz yönetirsiniz.",
    },
    {
      q: "Garson ve mutfak ekranları birlikte mi çalışır?",
      a: "Evet. Amaç tek kaynaktan gelen sipariş ve taleplerin sahada kaybolmadan ilerlemesi; ekip aynı akışı görür.",
    },
    {
      q: "Çoklu dil ve fiyat güncellemesi zor mu?",
      a: "Hayır. Dil ve fiyat güncellemeleri merkezi panelden yapılır; misafir tarafında anında yansır.",
    },
    {
      q: "Bağlılık veya gizli ücret var mı?",
      a: "Paketler işletme ölçeğinize göre netleştirilir; şeffaf fiyat ve kurulum kapsamı önceden konuşulur.",
    },
  ],
} as const;

export const landingFinalCta = {
  title: "Bugün konuşalım, yarın masada kullanın.",
  description: "Kısa bir görüşmede işletme tipinize uygun akışı ve paketi netleştiriyoruz.",
  primaryCta: { label: "Ücretsiz bilgi al", href: "#lead-form" },
} as const;

export const landingFooter = {
  brand: landingBrand.name,
  tagline: landingBrand.tagline,
  note: "© " + new Date().getFullYear() + " Catal App. Tüm hakları saklıdır.",
  links: [
    { label: "Blog", href: "/blog" },
    { label: "Kullanıcı Sözleşmesi", href: "/legal/kullanici-sozlesmesi" },
    { label: "KVKK", href: "/legal/kvkk" },
    { label: "Gizlilik", href: "/legal/gizlilik" },
  ] as const,
} as const;

export const landingLeadForm = {
  sectionId: "lead-form",
  eyebrow: "İletişim",
  title: "Kısa form, hızlı dönüş",
  description:
    "İsim, soyisim ve telefonunuzu bırakın; ekibimiz ihtiyacınıza göre dönüş yapsın. Not alanı isteğe bağlıdır.",
  submitLabel: "Gönder",
  consentText: "Verilerimin satış ekibiyle iletişime geçilmesi amacıyla kullanılmasını onaylıyorum.",
  successMessage: "Teşekkürler. Ekibimiz en kısa sürede sizinle iletişime geçecek.",
  trustBullets: ["Hızlı kurulum", "Şeffaf fiyat", "İşletmeye özel öneri"],
} as const;
