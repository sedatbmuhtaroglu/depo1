import Link from "next/link"
import { ArrowRight } from "lucide-react"

export default function CTAFinal() {
  return (
    <section className="section-container py-24">
      <div
        className="rounded-2xl px-8 md:px-16 py-14 text-center"
        style={{
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border-strong)",
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--brand)" }}>
          Hemen Başlayın
        </p>
        <h2
          className="text-3xl md:text-4xl font-bold text-balance mb-4"
          style={{ color: "var(--foreground)" }}
        >
          Operasyonunuzu bir üst seviyeye taşıyın.
        </h2>
        <p
          className="text-base leading-relaxed max-w-xl mx-auto mb-10"
          style={{ color: "var(--foreground-muted)" }}
        >
          Demo talep edin. İşletmenize özel bir sunum hazırlayalım, sorularınızı cevaplandıralım.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/demo"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-md text-sm font-semibold transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--brand)", color: "var(--brand-foreground)" }}
          >
            Demo Talep Et
            <ArrowRight size={15} />
          </Link>
          <Link
            href="/paketler"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-md text-sm font-medium transition-colors"
            style={{
              border: "1px solid var(--border-strong)",
              color: "var(--foreground-muted)",
            }}
          >
            Paketleri İncele
          </Link>
        </div>
      </div>
    </section>
  )
}
