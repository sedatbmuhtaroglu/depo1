/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');

const targetFile = path.join(__dirname, 'src/app/restaurant/reports/reports-view.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

const replacements = {
  "Gun sonu operasyon ozeti": "Gün sonu operasyon özeti",
  "Gun sonu raporu": "Gün sonu raporu",
  "Secili gun:": "Seçili gün:",
  "Gun": "Gün",
  "Gun sonu al": "Gün sonu al",
  "PDF goruntule": "PDF görüntüle",
  "Gunluk net ciro": "Günlük net ciro",
  "Tahsil edilen odemelere gore hesaplanir.": "Tahsil edilen ödemelere göre hesaplanır.",
  "Ort. teslim suresi": "Ort. teslim süresi",
  "Ort. hazirlama suresi": "Ort. hazırlama süresi",
  "Garson yanit ort.": "Garson yanıt ort.",
  "Ort. sipari? tutari": "Ort. sipariş tutarı",
  "Nakit ciro": "Nakit ciro",
  "Garson bazli ortalama yanit suresi": "Garson bazlı ortalama yanıt süresi",
  "Ornek": "Örnek",
  "Metrik notlari": "Metrik notları",
  "Donem rapor filtreleri": "Dönem rapor filtreleri",
  "Tarih araligini secip ozet ve tablolari yenileyin.": "Tarih aralığını seçip özet ve tabloları yenileyin.",
  "Bugun": "Bugün",
  "Baslangic": "Başlangıç",
  "Bitis": "Bitiş",
  "Yazdir": "Yazdır",
  "Donem finansal ozet": "Dönem finansal özet",
  "Brut ciro": "Brüt ciro",
  "Iade tutari": "İade tutarı",
  "Tamamlanan sipari?": "Tamamlanan sipariş",
  "Nakit duzeltme etkisi": "Nakit düzeltme etkisi",
  "Nakit kismi iptal/iade kayitlarinin ciroya etkisi.": "Nakit kısmı iptal/iade kayıtlarının ciroya etkisi.",
  "Brut sat??": "Brüt satış",
  "Nakit dusum": "Nakit düşüm",
  "Net sat??": "Net satış",
  "adet nakit duzeltme kaydi bulundu.": "adet nakit düzeltme kaydı bulundu.",
  "Odeme yontemine gore dagilim": "Ödeme yöntemine göre dağılım",
  "Yontem bazli adet ve tutar ozeti.": "Yöntem bazlı adet ve tutar özeti.",
  "Yontem": "Yöntem",
  "} dusuldu.": "} düşüldü.",
  "Odenmemis + teslim edilmis iptal kaydi:": "Ödenmemiş + teslim edilmiş iptal kaydı:",
  "Bu tutar cirodan dusulmez.": "Bu tutar cirodan düşülmez.",
  "Sonra ode secimi tahsilat degildir; ?deme alindiginda ilgili yonteme yazilir.": "Sonra öde seçimi tahsilat değildir; ödeme alındığında ilgili yönteme yazılır.",
  "Online ?deme siparisleri": "Online ödeme siparişleri",
  "Tahsilat ve iade sureci gorunumu.": "Tahsilat ve iade süreci görünümü.",
  "Urunler": "Ürünler",
  "Iade durumu": "İade durumu",
  "sipariste iade sureci kaydi bulundu.": "siparişte iade süreci kaydı bulundu.",
  "En cok satan urunler": "En çok satan ürünler",
  "Urun bazli adet ve ciro dagilimi.": "Ürün bazlı adet ve ciro dağılımı.",
  "Urun": "Ürün",
  "Iptal nedenleri": "İptal nedenleri",
  "Neden bazli iptal adet dagilimi.": "Neden bazlı iptal adet dağılımı.",
  "Iptal yapan personel": "İptal yapan personel",
  "Personel bazli iptal kaydi ve adet ozetleri.": "Personel bazlı iptal kaydı ve adet özetleri.",
  "Kisi": "Kişi",
  "Iptal kaydi": "İptal kaydı",
  "Secilen tarih araliginda raporlanacak veri yok.": "Seçilen tarih aralığında raporlanacak veri yok.",
  "En uzun teslim": "En uzun teslim",
  "Ortalama hazirlama": "Ortalama hazırlama",
  "Garson yanit ortalamasi": "Garson yanıt ortalaması",
  "Ortalama sipari? tutari": "Ortalama sipariş tutarı",
  "Tamamlanan sipari? sayisi": "Tamamlanan sipariş sayısı",
  "Iade bekliyor": "İade bekliyor",
  "Iade tamamlandi": "İade tamamlandı",
  "Iade basarisiz": "İade başarısız",
  "Iade yok": "İade yok",
  "Rapor tarih araligi": "Rapor tarih aralığı",
  "Siparis #": "Sipariş #",
};

for (const [key, value] of Object.entries(replacements)) {
  const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  content = content.replace(regex, value);
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Fixed reports-view.tsx');
