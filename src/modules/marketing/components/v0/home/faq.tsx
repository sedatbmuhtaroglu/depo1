"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"

const faqs = [
  {
    q: "Kurulum ne kadar sürer?",
    a: "Çoğu işletme için kurulum 1 iş günü içinde tamamlanır. Menünüzü sisteme aktarıyoruz, QR kodlarınızı oluşturuyoruz ve ekibinizi kısa bir onboarding süreciyle tanıştırıyoruz.",
  },
  {
    q: "Mevcut menümüzü taşıyabiliyor muyuz?",
    a: "Evet. Mevcut menünüzü Excel, PDF veya fotoğraf formatında bize iletmeniz yeterli. Kurulum sürecinde içeriğinizi biz aktarıyoruz.",
  },
  {
    q: "Garson çağırma özelliği var mı?",
    a: "Evet. Misafir QR arayüzünden 'Garson Çağır' ya da 'Hesap İstiyorum' talebini iletebilir. Bu talepler anında garson ekranına ve yönetici paneline düşer.",
  },
  {
    q: "Mutfak tarafı nasıl çalışıyor?",
    a: "Sipariş geldiğinde mutfak ekranına anlık bildirim gelir. Mutfak ekibinin telefon veya özel ekrana bakarak hangi siparişin hazırlandığını, hangisinin beklendiğini görmesi sağlanır.",
  },
  {
    q: "Çok şubeli kullanım destekleniyor mu?",
    a: "Evet. Kurumsal paket ile tüm şubelerinizi tek HQ paneli üzerinden yönetebilirsiniz. Her şube bağımsız çalışır, siz merkezi görünürlüğü korursunuz.",
  },
  {
    q: "Demo alabiliyor muyuz?",
    a: "Kesinlikle. Demo başvuru formunu doldurmanız yeterli. Size uygun bir zaman ayarlayarak işletmenizin ihtiyaçlarına göre Çatal App'i canlı olarak gösteriyoruz.",
  },
  {
    q: "İnternet olmadığında sistem ne yapar?",
    a: "Temel ürün işlevleri internet bağlantısı gerektir. Ancak kısa kesintilerde bazı veriler yerel önbellekte tutulur. Kesintisiz operasyon için güvenilir bir internet bağlantısı önerilir.",
  },
  {
    q: "Fiyatlandırma nasıl işliyor?",
    a: "Üç farklı paket sunuyoruz: Mini, Restoran ve Kurumsal. İşletmenizin büyüklüğüne ve ihtiyaçlarına göre en uygun paketi belirlemek için demo görüşmesinde konuşabiliyoruz.",
  },
]

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section
      style={{ backgroundColor: "var(--surface)", borderTop: "1px solid var(--border)" }}
    >
      <div className="section-container py-20">
        <div className="text-center mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--brand)" }}>
            Sık Sorulan Sorular
          </p>
          <h2 className="text-3xl md:text-4xl font-bold text-balance" style={{ color: "var(--foreground)" }}>
            Aklınızdaki sorular
          </h2>
        </div>

        <div className="max-w-2xl mx-auto flex flex-col gap-2">
          {faqs.map((faq, i) => (
            <div
              key={i}
              className="rounded-lg overflow-hidden"
              style={{ border: "1px solid var(--border)" }}
            >
              <button
                className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors"
                style={{ backgroundColor: open === i ? "var(--surface-2)" : "var(--background)" }}
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
              >
                <span className="text-sm font-medium pr-4" style={{ color: "var(--foreground)" }}>
                  {faq.q}
                </span>
                <ChevronDown
                  size={16}
                  className="flex-shrink-0 transition-transform duration-200"
                  style={{
                    color: "var(--foreground-muted)",
                    transform: open === i ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                />
              </button>
              {open === i && (
                <div className="px-5 pb-4" style={{ backgroundColor: "var(--surface-2)" }}>
                  <p className="text-sm leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
                    {faq.a}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
