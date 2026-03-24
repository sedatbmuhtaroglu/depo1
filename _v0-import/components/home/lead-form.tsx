"use client"

import { useState } from "react"
import { CheckCircle, ArrowRight } from "lucide-react"

export default function LeadForm() {
  const [submitted, setSubmitted] = useState(false)
  const [form, setForm] = useState({
    isletmeAdi: "",
    yetkiliAdi: "",
    telefon: "",
    email: "",
    sehir: "",
    not: "",
    kvkk: false,
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value, type } = e.target
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitted(true)
  }

  return (
    <section
      id="demo-form"
      style={{
        backgroundColor: "var(--surface)",
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="section-container py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-start">
          {/* Left */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--brand)" }}>
              Demo Talep Et
            </p>
            <h2
              className="text-3xl md:text-4xl font-bold leading-tight text-balance mb-4"
              style={{ color: "var(--foreground)" }}
            >
              Ürünü canlı görün,<br />kararınızı daha kolay verin.
            </h2>
            <p
              className="text-base leading-relaxed mb-8"
              style={{ color: "var(--foreground-muted)" }}
            >
              Demo başvurusu yapın, size uygun bir zaman belirleyelim. İşletmenizin ihtiyaçlarına göre Çatal App'i tanıtalım.
            </p>
            <ul className="flex flex-col gap-3">
              {[
                "İşletmenize özel kurulum danışmanlığı",
                "Mevcut menünüzü aktarma desteği",
                "Canlı operasyon simülasyonu",
                "Sorularınıza doğrudan yanıt",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--foreground-muted)" }}>
                  <CheckCircle size={15} style={{ color: "var(--brand)", marginTop: "2px", flexShrink: 0 }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Right — Form */}
          <div>
            {submitted ? (
              <div
                className="rounded-xl p-8 text-center"
                style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: "var(--brand-muted)" }}
                >
                  <CheckCircle size={22} style={{ color: "var(--brand)" }} />
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                  Başvurunuz Alındı
                </h3>
                <p className="text-sm" style={{ color: "var(--foreground-muted)" }}>
                  En kısa sürede sizinle iletişime geçeceğiz. Demo tarihini birlikte belirleyeceğiz.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                      İşletme Adı *
                    </label>
                    <input
                      type="text"
                      name="isletmeAdi"
                      required
                      value={form.isletmeAdi}
                      onChange={handleChange}
                      placeholder="Restoran / Kafe adı"
                      className="w-full px-3 py-2.5 rounded-md text-sm outline-none transition-colors"
                      style={{
                        backgroundColor: "var(--surface-2)",
                        border: "1px solid var(--border-strong)",
                        color: "var(--foreground)",
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                      Yetkili Adı *
                    </label>
                    <input
                      type="text"
                      name="yetkiliAdi"
                      required
                      value={form.yetkiliAdi}
                      onChange={handleChange}
                      placeholder="Ad Soyad"
                      className="w-full px-3 py-2.5 rounded-md text-sm outline-none transition-colors"
                      style={{
                        backgroundColor: "var(--surface-2)",
                        border: "1px solid var(--border-strong)",
                        color: "var(--foreground)",
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                      Telefon *
                    </label>
                    <input
                      type="tel"
                      name="telefon"
                      required
                      value={form.telefon}
                      onChange={handleChange}
                      placeholder="05xx xxx xx xx"
                      className="w-full px-3 py-2.5 rounded-md text-sm outline-none transition-colors"
                      style={{
                        backgroundColor: "var(--surface-2)",
                        border: "1px solid var(--border-strong)",
                        color: "var(--foreground)",
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                      E-posta *
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      value={form.email}
                      onChange={handleChange}
                      placeholder="ornek@isletme.com"
                      className="w-full px-3 py-2.5 rounded-md text-sm outline-none transition-colors"
                      style={{
                        backgroundColor: "var(--surface-2)",
                        border: "1px solid var(--border-strong)",
                        color: "var(--foreground)",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                    Şehir
                  </label>
                  <input
                    type="text"
                    name="sehir"
                    value={form.sehir}
                    onChange={handleChange}
                    placeholder="İstanbul, Ankara, İzmir..."
                    className="w-full px-3 py-2.5 rounded-md text-sm outline-none transition-colors"
                    style={{
                      backgroundColor: "var(--surface-2)",
                      border: "1px solid var(--border-strong)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--foreground-muted)" }}>
                    Not
                  </label>
                  <textarea
                    name="not"
                    value={form.not}
                    onChange={handleChange}
                    placeholder="İşletmeniz hakkında kısa bilgi veya sorularınız..."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-md text-sm outline-none transition-colors resize-none"
                    style={{
                      backgroundColor: "var(--surface-2)",
                      border: "1px solid var(--border-strong)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    name="kvkk"
                    required
                    checked={form.kvkk}
                    onChange={handleChange}
                    className="mt-0.5 rounded"
                    style={{ accentColor: "var(--brand)" }}
                  />
                  <span className="text-xs leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
                    KVKK kapsamında kişisel verilerimin işlenmesine ve tarafımla iletişim kurulmasına onay veriyorum.
                  </span>
                </label>

                <button
                  type="submit"
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-md text-sm font-semibold mt-1 transition-opacity hover:opacity-90"
                  style={{ backgroundColor: "var(--brand)", color: "var(--brand-foreground)" }}
                >
                  Demo Başvurusu Gönder
                  <ArrowRight size={15} />
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
