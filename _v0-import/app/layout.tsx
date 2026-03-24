import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Çatal App — Restoran Operasyon Platformu',
  description: 'QR menü, masa siparişi, garson çağrı ve merkezi yönetim. Çatal App ile servis akışınızı hızlandırın, operasyonunuzu görünür kılın.',
  keywords: 'QR menü, restoran yönetim, masa siparişi, garson çağrı, mutfak görünürlük, çok şubeli yönetim',
  openGraph: {
    title: 'Çatal App — Restoran Operasyon Platformu',
    description: 'QR menü, masa siparişi, garson çağrı ve merkezi yönetim. Servis akışınızı hızlandırın.',
    type: 'website',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="tr" className={inter.variable}>
      <body className="font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
