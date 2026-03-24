const metrics = [
  {
    label: "Canlı Operasyon Odağı",
    description: "Gerçek zamanlı sipariş ve masa takibi — kayıp sipariş, kaçan talep yok.",
  },
  {
    label: "Mobil Sipariş Deneyimi",
    description: "Misafir kendi masasından QR ile sipariş verir, garson sadece servis yapar.",
  },
  {
    label: "Merkezi Kontrol Yapısı",
    description: "Yönetici tüm masaları, siparişleri ve personeli tek ekrandan görür.",
  },
  {
    label: "Şube Bazlı Yönetim",
    description: "Her şubeyi ayrı ayrı veya birlikte yönetin. Merkez kontrolü kaybetmeyin.",
  },
]

const businesses = [
  "Nusret",
  "Sunset Beach",
  "Çınar Restoran",
  "Hotel Bosphorus",
  "Köy Sofrası",
  "Merkez Kafe",
]

export default function TrustSection() {
  return (
    <section className="section-container py-20">
      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-lg p-5"
            style={{
              backgroundColor: "var(--surface)",
              border: "1px solid var(--border)",
            }}
          >
            <div
              className="w-8 h-8 rounded-md flex items-center justify-center mb-4"
              style={{ backgroundColor: "var(--brand-muted)" }}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: "var(--brand)" }} />
            </div>
            <p className="text-sm font-semibold mb-2" style={{ color: "var(--foreground)" }}>
              {m.label}
            </p>
            <p className="text-xs leading-relaxed" style={{ color: "var(--foreground-muted)" }}>
              {m.description}
            </p>
          </div>
        ))}
      </div>

      {/* Business logo strip */}
      <div
        className="rounded-xl p-6"
        style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <p className="text-center text-xs font-semibold uppercase tracking-widest mb-6" style={{ color: "var(--foreground-subtle)" }}>
          Güvenen İşletmeler
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6">
          {businesses.map((name) => (
            <span
              key={name}
              className="text-sm font-medium tracking-wide"
              style={{ color: "var(--foreground-subtle)" }}
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
