const blocks = [
  {
    tag: "QR Menü & Sipariş",
    heading: "Sipariş süreci masadan başlar, mutfakta biter.",
    body: "Misafir masasındaki QR kodu okutarak menüye erişir, sipariş verir. Sipariş doğrudan mutfağa iletilir. Garsonun aracılığı gereksizleşir — hız artar, hata azalır.",
    bullets: [
      "Güncel menü yönetimi — fiyat, içerik, fotoğraf",
      "Mobil optimize, yüksek dönüşümlü sipariş arayüzü",
      "Sipariş anında mutfak ve yöneticiye iletilir",
    ],
    mockup: "qr-order",
  },
  {
    tag: "Garson & Mutfak Görünürlüğü",
    heading: "Kim ne yapıyor? Artık bilmek için sormak gerekmez.",
    body: "Garsonlar hangi masanın beklendiğini, mutfak hangi siparişin hazırlandığını anlık olarak görür. Koordinasyon sağlanır, servis senkronize olur.",
    bullets: [
      "Garson çağrı ve hesap talepleri anlık görünür",
      "Mutfak ekranı: hangi sipariş, hangi masa, ne zaman",
      "Masa durumu takibi: boş, dolu, bekleniyor",
    ],
    mockup: "kitchen",
  },
  {
    tag: "Merkezi HQ Kontrolü",
    heading: "Tüm şubelerinizi tek merkezden yönetin.",
    body: "Birden fazla lokasyonunuz mu var? Çatal App HQ paneli ile her şubenin operasyonunu izleyin, karşılaştırın ve yönetin. Herhangi bir şubedeki müdahale ihtiyacını anında fark edin.",
    bullets: [
      "Çok şubeli merkez yönetim paneli",
      "Şube bazlı performans ve operasyon görünümü",
      "Menü, fiyat ve kampanya merkezi kontrolü",
    ],
    mockup: "hq",
  },
]

function OrderMockup() {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border-strong)", backgroundColor: "var(--surface)" }}
    >
      <div className="px-4 py-3" style={{ backgroundColor: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
        <p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>Masa 5 — Sipariş</p>
      </div>
      <div className="p-4 flex flex-col gap-3">
        {[
          { name: "Izgara Somon", qty: 1, price: "₺420" },
          { name: "Mevsim Salatası", qty: 2, price: "₺180" },
          { name: "Limonata", qty: 2, price: "₺90" },
        ].map((item, i) => (
          <div key={i} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span
                className="w-5 h-5 rounded flex items-center justify-center text-xs font-medium"
                style={{ backgroundColor: "var(--surface-2)", color: "var(--brand)" }}
              >
                {item.qty}
              </span>
              <span style={{ color: "var(--foreground)" }}>{item.name}</span>
            </div>
            <span style={{ color: "var(--foreground-muted)" }}>{item.price}</span>
          </div>
        ))}
        <div
          className="pt-3 flex items-center justify-between text-sm font-semibold"
          style={{ borderTop: "1px solid var(--border)", color: "var(--foreground)" }}
        >
          <span>Toplam</span>
          <span style={{ color: "var(--brand)" }}>₺870</span>
        </div>
        <button
          className="w-full py-2 rounded-md text-xs font-semibold mt-1"
          style={{ backgroundColor: "var(--brand)", color: "var(--brand-foreground)" }}
        >
          Siparişi Onayla
        </button>
      </div>
    </div>
  )
}

function KitchenMockup() {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border-strong)", backgroundColor: "var(--surface)" }}
    >
      <div className="px-4 py-3" style={{ backgroundColor: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
        <p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>Mutfak Ekranı</p>
      </div>
      <div className="p-4 grid grid-cols-2 gap-3">
        {[
          { masa: "Masa 2", items: "Köfte x2", status: "Hazırlanıyor", time: "4dk" },
          { masa: "Masa 5", items: "Somon x1", status: "Bekliyor", time: "1dk" },
          { masa: "Masa 8", items: "Salata x3", status: "Hazır", time: "—" },
          { masa: "Masa 3", items: "Çorba x2", status: "Hazırlanıyor", time: "7dk" },
        ].map((order, i) => (
          <div
            key={i}
            className="rounded-lg p-3"
            style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>{order.masa}</p>
              <span style={{ color: "var(--foreground-subtle)", fontSize: "10px" }}>{order.time}</span>
            </div>
            <p style={{ color: "var(--foreground-muted)", fontSize: "11px" }}>{order.items}</p>
            <span
              className="inline-block mt-2 px-2 py-0.5 rounded-full text-xs"
              style={{
                backgroundColor: order.status === "Hazır" ? "rgba(34,197,94,0.12)" : "rgba(245,158,11,0.12)",
                color: order.status === "Hazır" ? "#22c55e" : "#f59e0b",
                fontSize: "10px",
              }}
            >
              {order.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function HQMockup() {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: "1px solid var(--border-strong)", backgroundColor: "var(--surface)" }}
    >
      <div className="px-4 py-3" style={{ backgroundColor: "var(--surface-2)", borderBottom: "1px solid var(--border)" }}>
        <p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>HQ Panel — Tüm Şubeler</p>
      </div>
      <div className="p-4 flex flex-col gap-3">
        {[
          { branch: "İstanbul — Merkez", tables: 24, orders: 18, status: "Aktif" },
          { branch: "Ankara — Kızılay", tables: 16, orders: 9, status: "Aktif" },
          { branch: "İzmir — Alsancak", tables: 20, orders: 5, status: "Sakin" },
        ].map((b, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg px-3 py-3"
            style={{ backgroundColor: "var(--surface-2)", border: "1px solid var(--border)" }}
          >
            <div>
              <p className="text-xs font-medium" style={{ color: "var(--foreground)" }}>{b.branch}</p>
              <p style={{ color: "var(--foreground-muted)", fontSize: "11px" }}>{b.tables} masa · {b.orders} sipariş</p>
            </div>
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{
                backgroundColor: "rgba(34,197,94,0.12)",
                color: "var(--brand)",
                fontSize: "10px",
              }}
            >
              {b.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const mockupMap: Record<string, React.ReactNode> = {
  "qr-order": <OrderMockup />,
  kitchen: <KitchenMockup />,
  hq: <HQMockup />,
}

export default function ValueStory() {
  return (
    <section className="section-container py-20">
      <div className="text-center mb-14">
        <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--brand)" }}>
          Nasıl Çalışır
        </p>
        <h2
          className="text-3xl md:text-4xl font-bold text-balance"
          style={{ color: "var(--foreground)" }}
        >
          Operasyonun her katmanı için
        </h2>
      </div>

      <div className="flex flex-col gap-16">
        {blocks.map((block, i) => (
          <div
            key={block.tag}
            className={`grid grid-cols-1 lg:grid-cols-2 gap-10 items-center ${i % 2 === 1 ? "lg:flex lg:flex-row-reverse" : ""}`}
          >
            <div>
              <span
                className="inline-block text-xs font-semibold uppercase tracking-widest mb-4 px-3 py-1 rounded-full"
                style={{ backgroundColor: "var(--brand-muted)", color: "var(--brand)" }}
              >
                {block.tag}
              </span>
              <h3
                className="text-2xl font-bold leading-snug mb-4 text-balance"
                style={{ color: "var(--foreground)" }}
              >
                {block.heading}
              </h3>
              <p className="text-sm leading-relaxed mb-6" style={{ color: "var(--foreground-muted)" }}>
                {block.body}
              </p>
              <ul className="flex flex-col gap-2.5">
                {block.bullets.map((b) => (
                  <li key={b} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--foreground-muted)" }}>
                    <span
                      className="w-4 h-4 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0"
                      style={{ backgroundColor: "var(--brand-muted)" }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: "var(--brand)" }} />
                    </span>
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div>{mockupMap[block.mockup]}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
