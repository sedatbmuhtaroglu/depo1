const fs = require('fs');
const path = require('path');

const paymentFile = path.join(__dirname, 'src/app/restaurant/settings/payment-settings-section.tsx');
let paymentContent = fs.readFileSync(paymentFile, 'utf8');

const paymentReplacements = {
  "IyziCo ayarlari kaydedilemedi": "IyziCo ayarları kaydedilemedi",
  "Odeme yontemleri kaydedilemedi": "Ödeme yöntemleri kaydedilemedi",
  "Odeme ayarlari kaydedildi": "Ödeme ayarları kaydedildi",
  "Odeme ayarlari": "Ödeme ayarları",
  "Musteri odeme yontemleri": "Müşteri ödeme yöntemleri",
  "Nakit odeme": "Nakit ödeme",
  "Kredi karti ile odeme": "Kredi kartı ile ödeme",
  "IyziCo (Kart ile odeme)": "IyziCo (Kart ile ödeme)",
  "Konfigurasyon aktif": "Konfigürasyon aktif",
  "Degistirmek icin yeni deger girin": "Değiştirmek için yeni değer girin",
  "kayitli. Degistirmek icin yeni deger": "kayıtlı. Değiştirmek için yeni değer",
  "Test modu acikken IyziCo sandbox ortami kullanilir.": "Test modu açıkken IyziCo sandbox ortamı kullanılır."
};

for (const [key, value] of Object.entries(paymentReplacements)) {
  const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  paymentContent = paymentContent.replace(regex, value);
}

fs.writeFileSync(paymentFile, paymentContent, 'utf8');
console.log('Fixed payment file');

const settingsFile = path.join(__dirname, 'src/app/restaurant/settings/settings-form.tsx');
let settingsContent = fs.readFileSync(settingsFile, 'utf8');

const settingsReplacements = {
  "Enlem -90 ile 90 arasinda olmalidir": "Enlem -90 ile 90 arasında olmalıdır",
  "Boylam -180 ile 180 arasinda olmalidir": "Boylam -180 ile 180 arasında olmalıdır",
  "araliginda olmalidir.": "aralığında olmalıdır."
};

for (const [key, value] of Object.entries(settingsReplacements)) {
  const regex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  settingsContent = settingsContent.replace(regex, value);
}

fs.writeFileSync(settingsFile, settingsContent, 'utf8');
console.log('Fixed settings form file');
