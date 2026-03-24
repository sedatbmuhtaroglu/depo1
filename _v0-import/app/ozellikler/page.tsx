import Header from "@/components/header"
import Footer from "@/components/footer"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

const featureGroups = [
  {
    tag: "Menü Yönetimi",
    title: "QR Menü Yönetimi",
    desc: "Menünüzü istediğiniz zaman güncelleyin. Fiyat, içerik, fotoğraf ve kategorileri merkezi panelden yönetin. Değişiklikler anında tüm QR kodlarına yansır.",
    bullets: [
      "Kategori ve ürün bazlı düzenleme",
      "Fotoğraf, içerik, alerjen bilgisi desteği",
      "Anlık fiyat güncelleme",
      "Kampanya ve sezon menüsü oluşturma",
    ],
  },
  {
    tag: "Sipariş Akışı",
    title: "Sipariş Akışı",
    desc: "Sipariş masadan başlar, mutfakta biter. Her adım kayıt altındadır, hiçbir talep kaçmaz.",
    bullets: [
      "Masadan QR ile sipariş verme",
      "Sipariş onay ve düzenleme akışı",
      "Sipariş durumu takibi: bekliyor, hazırlanıyor, hazır",
      "Anlık bildirim sistemi",
    ],
  },
  {
    tag: "Servis",
    title: "Garson Çağrı Yönetimi",
    desc: "Misafirler garson veya hesap çağrısını dijital olarak yapar. Garsonlar gelen talepleri ekranlarından anlık takip eder.",
    bullets: [
      "Garson çağrı talebi — masadan QR ile",
      "Hesap isteme / sipariş değişikliği",
      "Garson bildirimi: mobil veya ekran",
      "Çağrı geçmişi ve yanıt süresi takibi",
    ],
  },
  {
    tag: "Mutfak",
    title: "Mutfak Görünürlüğü",
    desc: "Mutfak ekibi hangi siparişin ne zaman geldiğini, hangisinin hazırlanmakta olduğunu ve hangisinin teslim edilmeyi beklediğini anlık olarak görür.",
    bullets: [
      "Mutfak ekranı — sipariş kuyruğu",
      "Sipariş önceliklendirme",
      "Hazır bildirimi — servise geçiş",
      "Mutfak yük analizi",
    ],
  },
  {
    tag: "Masa Yönetimi",
    title: "Masa ve Servis Akışı",
    desc: "Tüm masaların anlık durumunu görün. Hangi masa dolu, hangi masa beklenmeye başladı, hangisinin hesabı istendi — hepsi tek panelde.",
    bullets: [
      "Masa durumu: boş / dolu / bekleniyor",
      "Masa bazlı sipariş ve hesap takibi",
      "Masa devir hızı analizi",
      "Esnek masa planı düzeni",
    ],
  },
  {
    tag: "Panel",
    title: "Yönetici Paneli",
    desc: "İşletmenizin tüm operasyonunu tek bir panelden izleyin. Canlı sipariş akışı, masa doluluk oranı, personel aktivitesi ve servis süresi — hepsi görünür.",
    bullets: [
      "Gerçek zamanlı operasyon dashboard'u",
      "Personel aktivite takibi",
      "Günlük / haftalık operasyon özeti",
      "Anlık uyarı ve bildirimler",
    ],
  },
  {
    tag: "Çok Şubeli",
    title: "Merkezi HQ Yapısı",
    desc: "Birden fazla şubeniz varsa her birini ayrı ayrı veya toplu olarak yönetebilirsiniz. Merkezi menü kontrolü, şube bazlı raporlama.",
    bullets: [
      "Tüm şubeler tek HQ panel üzerinden",
      "Şubeye özel veya merkezi menü",
      "Şube karşılaştırmalı operasyon görünümü",
      "Yetkili kullanıcı ve erişim yönetimi",
    ],
  },
  {
    tag: "Ölçeklenebilirlik",
    title: "Çok Şubeli Yönetim",
    desc: "Büyüyen işletmeniz için ölçeklenebilir altyapı. Yeni şubeyi sisteme eklemek saatler içinde tamamlanır.",
    bullets: [
      "Hızlı şube kurulumu",
      "Şubeye özel kullanıcı tanımlamaları",
      "Konsolidasyon ve merkezi fatura takibi",
      "Çok lokasyonlu işletmelere özel paket",
    ],
  },
  {
    tag: "Analiz",
    title: "Operasyonel Görünürlük",
    desc: "Veriye dayalı kararlar alın. Hangi ürünler en çok sipariş ediliyor, hangi saatlerde yoğunluk artıyor, servis süreniz ne kadar — hepsi kayıt altında.",
    bullets: [
      "En çok sipariş edilen ürünler",
      "Saatlik / günlük yoğunluk analizi",
      "Ortalama servis süresi",
      "Masa devir hızı metrikleri",
    ],
  },
  {
    tag: "Mobil",
    title: "Mobil Deneyim",
    desc: "Hem misafir hem personel tarafında mobil öncelikli tasarım. Hızlı yükleme, dokunmatik optimize arayüzler, uygulama gerektirmeyen yapı.",
    bullets: [
      "Uygulama gerektirmeyen misafir arayüzü",
      "PWA desteği ile personel erişimi",
      "Dokunmatik optimize menü ve sipariş arayüzü",
      "Düşük bant genişliğine uyumlu",
    ],
  },
]

export default function OzelliklerPage() {
  return (
    <div style={{ backgroundColor: "var(--background)", minHeight: "100vh" }}>
      <Header />
      <main>
        {/* Page Hero */}
        <section className="section-container pt-16 pb-12">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--brand)" }}>
              Özellikler
            </p>
            <h1
              className="text-4xl md:text-5xl font-bold leading-tight text-balance mb-4"
              style={{ color: "var(--foreground)" }}
            >
              Restoran operasyonunun her katmanı için
            </h1>
            <p className="text-base leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
              Çatal App, sadece QR menüden ibaret değil. Sipariş akışından mutfak koordinasyonuna, garson yönetiminden merkezi şube kontrolüne kadar geniş bir operasyon paketi.
            </p>
          </div>
        </section>

        {/* Feature Grid */}
        <section className="section-container pb-24">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {featureGroups.map((feat, i) => (
              <div
                key={feat.title}
                className={`rounded-xl p-6 ${i === 0 ? "lg:col-span-2" : ""}`}
                style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <span
                      className="inline-block text-xs font-semibold uppercase tracking-widest mb-2 px-2.5 py-1 rounded-full"
                      style={{ backgroundColor: "var(--brand-muted)", color: "var(--brand)" }}
                    >
                      {feat.tag}
                    </span>
                    <h2 className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
                      {feat.title}
                    </h2>
                  </div>
                </div>
                <p className="text-sm leading-relaxed mb-5" style={{ color: "var(--foreground-muted)" }}>
                  {feat.desc}
                </p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {feat.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2 text-xs" style={{ color: "var(--foreground-muted)" }}>
                      <span
                        className="w-3.5 h-3.5 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0"
                        style={{ backgroundColor: "var(--brand-muted)" }}
                      >
                        <span className="w-1 h-1 rounded-full" style={{ backgroundColor: "var(--brand)" }} />
                      </span>
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-12 text-center">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-md text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--brand)", color: "var(--brand-foreground)" }}
            >
              Demo Talep Et
              <ArrowRight size={15} />
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
