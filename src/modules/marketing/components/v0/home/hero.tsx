import Link from "next/link"
import { CheckCircle, ArrowRight } from "lucide-react"

const trustPoints = [
  "Hızlı kurulum",
  "Mobil uyumlu deneyim",
  "Operasyon odaklı yapı",
  "Yönetici görünürlüğü",
]

function DashboardMockup() {
  return (
    <div
      className="relative w-full rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border-strong)" }}
    >
      {/* Dashboard Header */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ backgroundColor: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#3d4555" }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#3d4555" }} />
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "#3d4555" }} />
        </div>
        <div className="flex-1 mx-4">
          <div className="mx-auto w-36 h-5 rounded" style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}>
            <span className="block text-center text-xs leading-5" style={{ color: "var(--foreground-muted)", fontSize: "10px" }}>
              catal.app/panel
            </span>
          </div>
        </div>
      </div>

      {/* Dashboard Body */}
      <div className="p-4" style={{ backgroundColor: "var(--surface)" }}>
        {/* Top stats row */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Aktif Masa", value: "12", sub: "4 bekliyor" },
            { label: "Açık Sipariş", value: "8", sub: "2 hazır" },
            { label: "Garson Çağrı", value: "3", sub: "şu an aktif" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg p-3"
              style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
            >
              <p className="text-xs mb-1" style={{ color: "var(--foreground-muted)" }}>{stat.label}</p>
              <p className="text-xl font-semibold" style={{ color: "var(--foreground)" }}>{stat.value}</p>
              <p className="text-xs mt-0.5" style={{ color: "var(--brand)", fontSize: "10px" }}>{stat.sub}</p>
            </div>
          ))}
        </div>

        {/* Order list */}
        <div
          className="rounded-lg overflow-hidden"
          style={{ border: "1px solid var(--border)" }}
        >
          <div
            className="px-3 py-2.5 flex items-center justify-between"
            style={{ backgroundColor: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}
          >
            <span className="text-xs font-medium" style={{ color: "var(--foreground)" }}>Canlı Siparişler</span>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: "var(--brand-muted)", color: "var(--brand)" }}
            >
              8 aktif
            </span>
          </div>
          {[
            { masa: "Masa 4", urun: "Izgara Tavuk, Ayran", durum: "Hazırlanıyor", color: "#f59e0b" },
            { masa: "Masa 7", urun: "Mercimek Çorbası, Pilav", durum: "Hazır", color: "#22c55e" },
            { masa: "Masa 2", urun: "Köfte Tabağı", durum: "Bekliyor", color: "#8a94a8" },
          ].map((order, i) => (
            <div
              key={i}
              className="px-3 py-2.5 flex items-center justify-between"
              style={{
                borderBottom: i < 2 ? "1px solid var(--border)" : "none",
                backgroundColor: "var(--surface)",
              }}
            >
              <div className="flex items-center gap-3">
                <div className="text-xs font-medium w-14" style={{ color: "var(--foreground)" }}>{order.masa}</div>
                <div className="text-xs" style={{ color: "var(--foreground-muted)", fontSize: "11px" }}>{order.urun}</div>
              </div>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{ color: order.color, backgroundColor: `${order.color}18`, fontSize: "10px" }}
              >
                {order.durum}
              </span>
            </div>
          ))}
        </div>

        {/* Mobile mockup floating */}
        <div className="mt-3 flex gap-3">
          <div
            className="flex-1 rounded-lg p-3"
            style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            <p className="text-xs font-medium mb-2" style={{ color: "var(--foreground)" }}>Garson Çağrıları</p>
            {["Masa 3 — Hesap istedi", "Masa 9 — Garson çağrısı"].map((call, i) => (
              <div key={i} className="flex items-center gap-2 mb-1.5">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: "var(--brand)" }} />
                <span style={{ color: "var(--foreground-muted)", fontSize: "10px" }}>{call}</span>
              </div>
            ))}
          </div>
          <div
            className="rounded-lg p-3 flex flex-col justify-between"
            style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)", minWidth: "80px" }}
          >
            <p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>Mutfak</p>
            <div className="text-center">
              <p className="text-2xl font-bold" style={{ color: "var(--brand)" }}>5</p>
              <p style={{ color: "var(--foreground-muted)", fontSize: "10px" }}>bekleyen</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Hero() {
  return (
    <section className="section-container py-20 md:py-28">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Left */}
        <div>
          <div
            className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full mb-6"
            style={{
              backgroundColor: "var(--brand-muted)",
              color: "var(--brand)",
              border: "1px solid rgba(34,197,94,0.2)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            QR Menü & Restoran Operasyon Platformu
          </div>

          <h1
            className="text-4xl md:text-5xl lg:text-5xl font-bold leading-tight text-balance mb-5"
            style={{ color: "var(--foreground)" }}
          >
            Servis hızını artırın,{" "}
            <span style={{ color: "var(--brand)" }}>operasyonu</span>{" "}
            görünür kılın.
          </h1>

          <p
            className="text-base leading-relaxed mb-8 max-w-lg"
            style={{ color: "var(--foreground-muted)" }}
          >
            Çatal App ile QR menü sadece bir gösterim aracı değil, operasyonunuzun aktif parçasıdır. Sipariş alın, garson koordinasyonu sağlayın, mutfağı bilgilendirin — tek bir ekrandan.
          </p>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-8">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--brand)", color: "var(--brand-foreground)" }}
            >
              Demo Talep Et
              <ArrowRight size={15} />
            </Link>
            <Link
              href="/ozellikler"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium transition-colors"
              style={{
                border: "1px solid var(--border-strong)",
                color: "var(--foreground-muted)",
                backgroundColor: "transparent",
              }}
            >
              Özellikleri İncele
            </Link>
          </div>

          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {trustPoints.map((point) => (
              <div key={point} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--foreground-muted)" }}>
                <CheckCircle size={13} style={{ color: "var(--brand)", flexShrink: 0 }} />
                {point}
              </div>
            ))}
          </div>
        </div>

        {/* Right — Product Mockup */}
        <div className="relative">
          <DashboardMockup />
          {/* Floating badge */}
          <div
            className="absolute -bottom-4 -left-4 hidden md:flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium shadow-2xl"
            style={{
              backgroundColor: "var(--surface-2)",
              border: "1px solid var(--border-strong)",
              color: "var(--foreground)",
            }}
          >
            <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "var(--brand)" }} />
            Canlı operasyon görünürlüğü
          </div>
        </div>
      </div>
    </section>
  )
}
