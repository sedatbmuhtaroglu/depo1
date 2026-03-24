const segments = [
  { icon: "🍽", label: "Restoran" },
  { icon: "☕", label: "Kafe" },
  { icon: "🏖", label: "Beach / Hotel" },
  { icon: "🏢", label: "Çok Şubeli Yapı" },
]

export default function SegmentStrip() {
  return (
    <section
      style={{
        borderTop: "1px solid var(--border)",
        borderBottom: "1px solid var(--border)",
        backgroundColor: "var(--surface)",
      }}
    >
      <div className="section-container py-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--foreground-subtle)" }}>
            Uygun işletme türleri
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {segments.map((seg) => (
              <div
                key={seg.label}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
                style={{
                  backgroundColor: "var(--surface-2)",
                  border: "1px solid var(--border-strong)",
                  color: "var(--foreground)",
                }}
              >
                <span aria-hidden="true" className="text-base leading-none">{seg.icon}</span>
                {seg.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
