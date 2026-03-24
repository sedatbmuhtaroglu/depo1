"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"

const navItems = [
  { label: "Özellikler", href: "/ozellikler" },
  { label: "Kullanım Alanları", href: "/kullanim-alanlari" },
  { label: "Paketler", href: "/paketler" },
  { label: "Hakkımızda", href: "/hakkimizda" },
]

export default function Header() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 12)
    window.addEventListener("scroll", handler, { passive: true })
    return () => window.removeEventListener("scroll", handler)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [pathname])

  return (
    <>
      {/* Announcement Bar */}
      <div
        className="w-full py-2 px-4 text-center text-xs font-medium tracking-wide"
        style={{
          backgroundColor: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          color: "var(--foreground-muted)",
        }}
      >
        <span className="inline-flex items-center gap-2">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: "var(--brand)" }}
          />
          Kurulum 1 günde tamamlanır — Demo için hemen başvurun
        </span>
      </div>

      {/* Header */}
      <header
        className="sticky top-0 z-50 w-full transition-all duration-300"
        style={{
          backgroundColor: scrolled ? "rgba(11,15,26,0.95)" : "rgba(11,15,26,0.8)",
          borderBottom: `1px solid ${scrolled ? "var(--border-strong)" : "var(--border)"}`,
          backdropFilter: "blur(16px)",
        }}
      >
        <div className="section-container flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-md flex items-center justify-center"
              style={{ backgroundColor: "var(--brand)" }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 1v5.5M3 8.5V13M7 1v12M11 1v3.5M11 6.5V13" stroke="#0b0f1a" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <span
              className="text-base font-semibold tracking-tight"
              style={{ color: "var(--foreground)" }}
            >
              Çatal
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="px-3.5 py-2 text-sm rounded-md transition-colors duration-150"
                style={{
                  color: pathname === item.href ? "var(--foreground)" : "var(--foreground-muted)",
                  backgroundColor: pathname === item.href ? "var(--surface-2)" : "transparent",
                }}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/demo"
              className="text-sm px-3.5 py-2 rounded-md transition-colors"
              style={{ color: "var(--foreground-muted)" }}
            >
              Giriş Yap
            </Link>
            <Link
              href="/demo"
              className="text-sm px-4 py-2 rounded-md font-medium transition-all duration-150 hover:opacity-90"
              style={{
                backgroundColor: "var(--brand)",
                color: "var(--brand-foreground)",
              }}
            >
              Demo Talep Et
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="md:hidden p-2 rounded-md"
            style={{ color: "var(--foreground-muted)" }}
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menüyü aç/kapat"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div
            className="md:hidden border-t"
            style={{
              backgroundColor: "var(--surface)",
              borderColor: "var(--border)",
            }}
          >
            <div className="section-container py-4 flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-2.5 text-sm rounded-md"
                  style={{
                    color: pathname === item.href ? "var(--foreground)" : "var(--foreground-muted)",
                    backgroundColor: pathname === item.href ? "var(--surface-2)" : "transparent",
                  }}
                >
                  {item.label}
                </Link>
              ))}
              <div className="mt-3 pt-3 flex flex-col gap-2" style={{ borderTop: "1px solid var(--border)" }}>
                <Link
                  href="/demo"
                  className="w-full text-center text-sm px-4 py-2.5 rounded-md font-medium"
                  style={{ backgroundColor: "var(--brand)", color: "var(--brand-foreground)" }}
                >
                  Demo Talep Et
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  )
}
