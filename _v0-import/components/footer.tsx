import Link from "next/link"

const footerLinks = {
  Ürün: [
    { label: "Özellikler", href: "/ozellikler" },
    { label: "Kullanım Alanları", href: "/kullanim-alanlari" },
    { label: "Paketler", href: "/paketler" },
    { label: "Canlı Önizleme", href: "/demo" },
  ],
  Şirket: [
    { label: "Hakkımızda", href: "/hakkimizda" },
    { label: "Demo Talep Et", href: "/demo" },
    { label: "İletişim", href: "/demo" },
  ],
  Hukuki: [
    { label: "Gizlilik Politikası", href: "#" },
    { label: "Kullanım Koşulları", href: "#" },
    { label: "KVKK Aydınlatma", href: "#" },
  ],
}

export default function Footer() {
  return (
    <footer
      style={{
        backgroundColor: "var(--surface)",
        borderTop: "1px solid var(--border)",
      }}
    >
      <div className="section-container py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center"
                style={{ backgroundColor: "var(--brand)" }}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 1v5.5M3 8.5V13M7 1v12M11 1v3.5M11 6.5V13" stroke="#0b0f1a" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
                Çatal App
              </span>
            </Link>
            <p
              className="text-sm leading-relaxed max-w-xs"
              style={{ color: "var(--foreground-muted)" }}
            >
              Restoran, kafe, otel ve çok şubeli işletmeler için QR menü ve operasyon yönetim platformu.
            </p>
            <div className="mt-6">
              <Link
                href="/demo"
                className="inline-flex text-sm px-4 py-2 rounded-md font-medium transition-opacity hover:opacity-90"
                style={{ backgroundColor: "var(--brand)", color: "var(--brand-foreground)" }}
              >
                Demo Talep Et
              </Link>
            </div>
          </div>

          {/* Links */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-4" style={{ color: "var(--foreground-subtle)" }}>
                {title}
              </p>
              <ul className="flex flex-col gap-3">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm transition-colors hover:text-white"
                      style={{ color: "var(--foreground-muted)" }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="mt-16 pt-8 flex flex-col md:flex-row items-center justify-between gap-4"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
            © 2025 Çatal App. Tüm hakları saklıdır.
          </p>
          <p className="text-xs" style={{ color: "var(--foreground-subtle)" }}>
            Türkiye'den, restoranlar için.
          </p>
        </div>
      </div>
    </footer>
  )
}
