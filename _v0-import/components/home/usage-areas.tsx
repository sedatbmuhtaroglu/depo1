const areas = [
  {
    title: "Hızlı Servis",
    desc: "Yoğun saatlerde sipariş kuyruğunu ortadan kaldırın. Masadan direkt sipariş, daha hızlı servis.",
    tags: ["QR Sipariş", "Anlık İletim", "Yoğun Kapasite"],
  },
  {
    title: "Self Servis",
    desc: "Misafir kendi başına sipariş verir, masadan kalkmaz. Garson sayısına bağımlılığı azaltın.",
    tags: ["Bağımsız Sipariş", "Az Personel", "Maliyet Kontrolü"],
  },
  {
    title: "Servis Restoranı",
    desc: "Garson desteğiyle birlikte dijital sipariş akışı. Hem hız hem servis kalitesi.",
    tags: ["Garson Koordinasyonu", "Masa Takibi", "Mutfak Ekranı"],
  },
  {
    title: "Beach / Otel / Lounge",
    desc: "Uzak masa ve şezlonglardan sipariş alın. Her noktadan servis görünürlüğü.",
    tags: ["Geniş Alan", "Çoklu Nokta", "Otel Entegrasyonu"],
  },
]

export default function UsageAreas() {
  return (
    <section className="section-container py-20">
      <div className="text-center mb-12">
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--brand)" }}>
          Kullanım Alanları
        </p>
        <h2 className="text-3xl md:text-4xl font-bold text-balance" style={{ color: "var(--foreground)" }}>
          Hangi işletme modeline uygun?
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {areas.map((area) => (
          <div
            key={area.title}
            className="rounded-xl p-6 flex flex-col gap-4 transition-colors"
            style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div>
              <h3 className="text-base font-semibold mb-2" style={{ color: "var(--foreground)" }}>{area.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--foreground-muted)" }}>{area.desc}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {area.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-xs px-2.5 py-1 rounded-full"
                  style={{
                    backgroundColor: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground-muted)",
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
