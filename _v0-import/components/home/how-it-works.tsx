const steps = [
  {
    num: "01",
    title: "QR Okutulur",
    desc: "Misafir masadaki QR kodu telefonu ile okutarak dijital menüye erişir. Uygulama indirmek gerekmez.",
  },
  {
    num: "02",
    title: "Sipariş Oluşur",
    desc: "Menüyü inceleyen misafir siparişini verir ya da garson çağrısı yapar. Talep anında sisteme düşer.",
  },
  {
    num: "03",
    title: "Operasyon Akışı Hızlanır",
    desc: "Sipariş mutfağa, garson ekranına ve yönetici paneline iletilir. Herkes üzerine düşeni bilir, servis hızlanır.",
  },
]

export default function HowItWorks() {
  return (
    <section
      style={{ backgroundColor: "var(--surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}
    >
      <div className="section-container py-20">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--brand)" }}>
            Süreç
          </p>
          <h2
            className="text-3xl md:text-4xl font-bold text-balance"
            style={{ color: "var(--foreground)" }}
          >
            3 adımda nasıl çalışır?
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* Connector line — desktop only */}
          <div
            className="hidden md:block absolute top-10 left-[16%] right-[16%] h-px"
            style={{ backgroundColor: "var(--border-strong)" }}
          />

          {steps.map((step) => (
            <div key={step.num} className="relative flex flex-col items-start md:items-center text-left md:text-center">
              {/* Step number circle */}
              <div
                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 relative z-10"
                style={{
                  backgroundColor: "var(--background)",
                  border: "1px solid var(--border-strong)",
                }}
              >
                <span className="text-2xl font-bold" style={{ color: "var(--brand)" }}>{step.num}</span>
              </div>
              <h3 className="text-base font-semibold mb-2" style={{ color: "var(--foreground)" }}>
                {step.title}
              </h3>
              <p className="text-sm leading-relaxed max-w-xs" style={{ color: "var(--foreground-muted)" }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
