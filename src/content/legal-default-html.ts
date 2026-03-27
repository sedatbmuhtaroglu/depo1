import type { LegalPublicPagesV1 } from "@/modules/marketing/legal-public-pages";
import { LEGAL_PUBLIC_PAGES_VERSION } from "@/modules/marketing/legal-public-pages";

/** Kod içi varsayılan; HQ kaydı yoksa veya alan boşsa kullanılır. */
export const DEFAULT_LEGAL_LAST_UPDATED_LABEL = "26 Mart 2026";

export function buildDefaultLegalPublicPages(brandName: string): LegalPublicPagesV1 {
  return {
    version: LEGAL_PUBLIC_PAGES_VERSION,
    kullaniciSozlesmesiHtml: buildKullaniciHtml(brandName),
    kvkkHtml: buildKvkkHtml(brandName),
    gizlilikHtml: buildGizlilikHtml(brandName),
  };
}

function buildKullaniciHtml(brand: string): string {
  return `<p><strong>Uyarı:</strong> Bu metin genel bilgilendirme amaçlıdır; işletmenize özel hukuki danışmanlık yerine geçmez. Gerekirse metni hukuk danışmanınızla uyumlayın.</p>
<p>İşbu Kullanıcı Sözleşmesi (“<strong>Sözleşme</strong>”), <strong>${escapeHtml(brand)}</strong> (“<strong>Platform</strong>”) üzerinden sunulan web sitesi, uygulama ve ilgili hizmetlerin (“<strong>Hizmetler</strong>”) kullanımına ilişkin kuralları düzenler. Platforma erişen veya Hizmetleri kullanan gerçek veya tüzel kişiler (“<strong>Kullanıcı</strong>”) bu Sözleşme’yi kabul etmiş sayılır.</p>
<h2 id="tanimlar">1. Tanımlar</h2>
<ul>
<li><strong>Platform:</strong> ${escapeHtml(brand)} markası altında sunulan yazılım, web arayüzleri ve bağlı operasyonel özelliklerin bütünü.</li>
<li><strong>İşletme kullanıcısı:</strong> Restoran veya benzeri işletme adına hesap açan veya yetkili temsilcisi olan kullanıcı.</li>
<li><strong>Misafir kullanımı:</strong> Menü görüntüleme, sipariş veya talep ile sınırlı, hesap gerektirmeyebilen kullanım.</li>
</ul>
<h2 id="kabul">2. Sözleşmenin kabulü ve değişiklikler</h2>
<p>Hizmetleri kullanmaya başladığınızda bu Sözleşme hükümleriyle bağlı olursunuz. Platform, iş modeli veya mevzuat gereği Sözleşme’yi güncelleyebilir; güncel metin yayımlandığı tarihte geçerlidir. Önemli değişiklikler mümkün olduğunca bildirilir; güncel metin bu sayfada yayımlanır.</p>
<h2 id="hizmet">3. Hizmetin niteliği</h2>
<p>Platform; menü sunumu, sipariş iletimi, operasyonel paneller ve ilgili işlevlere yönelik teknik altyapı sağlar. Hizmetin kesintisiz veya hatasız olacağına dair garanti verilmez; bakım, güncelleme veya mücbir sebeplerle geçici kesintiler olabilir.</p>
<h2 id="hesap">4. Hesap, güvenlik ve yetkilendirme</h2>
<p>İşletme hesapları için doğru ve güncel bilgi vermek; güçlü parola kullanmak; hesap bilgilerini üçüncü kişilerle paylaşmamak Kullanıcı’nın sorumluluğundadır. Yetkisiz erişim şüphesinde Platform bildirilmelidir.</p>
<h2 id="kullanim">5. Kabul edilebilir kullanım</h2>
<p>Kullanıcı özellikle:</p>
<ul>
<li>Hizmetleri yasa dışı veya üçüncü kişilerin haklarını ihlal edecek şekilde kullanmaz;</li>
<li>Zararlı yazılım yaymak, sisteme yetkisiz müdahalede bulunmak veya güvenlik önlemlerini aşmaya çalışmaz;</li>
<li>Başkalarına ait kişisel verileri hukuka aykırı işlemez veya ifşa etmez;</li>
<li>Platformu spam, kötüye kullanım veya aşırı yük oluşturacak şekilde otomasyonla kötüye kullanmaz.</li>
</ul>
<h2 id="icerik">6. İçerik ve işletme sorumluluğu</h2>
<p>Menü, fiyat, açıklama ve işletmeye ait içeriklerin doğruluğu, güncelliği ve mevzuata uygunluğu işletmenin sorumluluğundadır. Platform, işletme tarafından girilen içerikleri denetlemekle yükümlü değildir; ancak yasal veya güvenlik gereği gerekli müdahaleleri yapabilir.</p>
<h2 id="odeme">7. Ödeme ve faturalandırma</h2>
<p>Ödeme veya abonelik ilişkisi varsa, ücretlendirme, faturalama ve iade koşulları ayrıca sözleşme veya teklif koşullarında belirtilir. Ödeme entegrasyonları üçüncü taraf sağlayıcılarına tabi olabilir.</p>
<h2 id="fikri">8. Fikri mülkiyet</h2>
<p>Platform yazılımı, tasarımı ve markaları üzerindeki haklar korunur. Kullanıcı’ya, yalnızca bu Sözleşme kapsamında Hizmetleri kullanmak için sınırlı, devredilemez bir kullanım hakkı verilir.</p>
<h2 id="sorumluluk">9. Sorumluluğun sınırlandırılması</h2>
<p>Yürürlükteki mevzuatın izin verdiği ölçüde; dolaylı zararlar, kayıp kâr, veri kaybı veya iş kesintisi gibi dolaylı zararlardan Platform sorumlu tutulamaz. Doğrudan zararlarda da toplam sorumluluk, mümkünse son on iki ayda işletme tarafından Platform’a ödenen ücretlerle sınırlı olabilir (ücret yoksa makul bir üst sınıra kadar).</p>
<h2 id="fesih">10. Sözleşmenin sona ermesi</h2>
<p>Kullanıcı hesabınızı veya işletme ilişkisini sonlandırma koşulları, aranızdaki ticari sözleşmeye veya Platform’un bildirim süreçlerine tabidir. Platform, ağır ihlal veya yasal zorunluluk halinde erişimi sınırlayabilir veya sonlandırabilir.</p>
<h2 id="uyusmazlik">11. Uyuşmazlık ve uygulanacak hukuk</h2>
<p>Uyuşmazlıklarda öncelikle iyi niyetli çözüm aranır. Taraflar arasındaki ilişkide Türkiye Cumhuriyeti mevzuatı uygulanır; yetkili mahkeme ve icra daireleri için yürürlükteki mevzuat çerçevesinde belirlenir (özel sözleşme veya tüketici hükümleri saklıdır).</p>
<h2 id="iletisim">12. İletişim</h2>
<p>Bu Sözleşme ile ilgili sorularınız için Platform’un web sitesinde veya sözleşmede bildirilen iletişim kanalları kullanılabilir.</p>`;
}

function buildKvkkHtml(brand: string): string {
  return `<p><strong>Uyarı:</strong> Bu metin genel bilgilendirme amaçlıdır. Veri sorumlusu unvanı, adres ve başvuru kanalları işletme yapınıza göre güncellenmelidir; hukuki danışmanlık önerilir.</p>
<p>6698 sayılı Kişisel Verilerin Korunması Kanunu (“<strong>KVKK</strong>”) uyarınca, <strong>${escapeHtml(brand)}</strong> (“<strong>Veri Sorumlusu</strong>”) olarak kişisel verilerinizi işlediğimiz durumlarda sizi bilgilendirmekteyiz.</p>
<h2 id="veri-sorumlusu">1. Veri sorumlusu</h2>
<p>Kişisel verileriniz, hizmetlerin sunulması kapsamında Veri Sorumlusu sıfatıyla işlenebilir. Güncel unvan, adres ve iletişim bilgileri web sitesinde veya sözleşme dokümanlarında yer alır.</p>
<h2 id="isleme-amaclari">2. İşlenen kişisel veriler ve işleme amaçları</h2>
<p>Hizmetin niteliğine bağlı olarak; kimlik, iletişim (ör. telefon, e-posta), işlem güvenliği, müşteri işlemleri, talep/şikâyet, sipariş ve ödeme işlemleriyle ilişkili kayıtlar, teknik loglar (ör. IP adresi, cihaz bilgisi, tarih-saat) işlenebilir.</p>
<p>Örnek amaçlar:</p>
<ul>
<li>Platform üzerinden hizmet sunmak ve sözleşmesel ilişkiyi yürütmek;</li>
<li>İletişim taleplerini yanıtlamak ve destek taleplerini yönetmek;</li>
<li>Yetkili kamu kurum ve kuruluşlarına karşı yasal yükümlülükleri yerine getirmek;</li>
<li>İş sürekliliği, güvenlik ve yetkisiz erişimlerin önlenmesi;</li>
<li>Açık rızanızın bulunduğu hallerde pazarlama veya iletişim (ayrıca açık rıza metnine tabi).</li>
</ul>
<h2 id="hukuki-sebepler">3. Hukuki sebepler</h2>
<p>Kişisel verileriniz; KVKK’nın 5 ve 6. maddelerinde sayılan; açık rıza, sözleşmenin kurulması veya ifası, hukuki yükümlülüklerin yerine getirilmesi, meşru menfaat veya bir hakkın tesisi veya korunması gibi hukuki sebeplere dayanarak işlenebilir.</p>
<h2 id="aktarim">4. Aktarım</h2>
<p>Hizmetin gerektirdiği ölçüde; barındırma (hosting), e-posta/SMS sağlayıcıları, ödeme altyapısı/ödeme kuruluşları, iş ortakları ve danışmanlarla veya yasal zorunluluk halinde yetkili kamu kurumlarıyla paylaşım yapılabilir. Aktarım, KVKK ve ilgili mevzuata uygun şekilde ve gerektiğinde gerekli teknik ve idari tedbirlerle gerçekleştirilir.</p>
<h2 id="toplanma-yontemi">5. Toplama yöntemi ve hukuki sebep</h2>
<p>Veriler; web sitesi, uygulama veya mobil arayüzler, formlar, çağrı merkezi, e-posta veya sözleşme süreçleri aracılığıyla otomatik veya kısmen otomatik yollarla toplanabilir.</p>
<h2 id="saklama">6. Saklama süresi</h2>
<p>Kişisel veriler, işleme amacının gerektirdiği süre ve ilgili mevzuatta öngörülen zamanaşımı süreleri kadar saklanır; süre sonunda silinir, yok edilir veya anonim hale getirilir.</p>
<h2 id="haklar">7. İlgili kişinin hakları (KVKK m. 11)</h2>
<p>KVKK kapsamında kişisel verilerinizle ilgili olarak:</p>
<ul>
<li>İşlenip işlenmediğini öğrenme,</li>
<li>İşlenmişse buna ilişkin bilgi talep etme,</li>
<li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme,</li>
<li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme,</li>
<li>Eksik veya yanlış işlenmişse düzeltilmesini isteme,</li>
<li>KVKK’da öngörülen şartlar çerçevesinde silinmesini veya yok edilmesini isteme,</li>
<li>Düzeltme, silme, yok etme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme,</li>
<li>Münhasıran otomatik sistemler ile analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme,</li>
<li>Kanuna aykırı işlenmesi sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme</li>
</ul>
<p>haklarına sahipsiniz.</p>
<h2 id="basvuru">8. Başvuru yöntemi</h2>
<p>Haklarınızı kullanmak için Veri Sorumlusu’na yazılı olarak veya Kişisel Verileri Koruma Kurulu’nun belirlediği yöntemlerle başvurabilirsiniz. Başvurularınız, KVKK’nın 13. maddesi uyarınca en geç otuz gün içinde sonuçlandırılır.</p>
<h2 id="guncelleme">9. Güncellemeler</h2>
<p>Bu aydınlatma metni, iş süreçleri veya mevzuat değişikliklerine göre güncellenebilir. Güncel sürüm bu sayfada yayımlanır.</p>`;
}

function buildGizlilikHtml(brand: string): string {
  return `<p><strong>Uyarı:</strong> Bu metin genel bilgilendirme amaçlıdır. Çerezler ve üçüncü taraf araçlar işletme ve kullanılan altyapıya göre değişir; metni güncel tutun.</p>
<p><strong>${escapeHtml(brand)}</strong> (“<strong>biz</strong>”, “<strong>Platform</strong>”) olarak gizliliğinize saygı duyuyoruz. Bu Gizlilik Politikası; web sitemizi veya Hizmetleri kullandığınızda kişisel verilerinizin nasıl toplanabileceğini, kullanılabileceğini ve korunacağını özetler.</p>
<h2 id="kapsam">1. Kapsam</h2>
<p>Politika; Platform’un web sitesi, uygulama ve bağlı dijital kanalları kapsar. İşletme hesapları için ek sözleşmesel hükümler saklıdır.</p>
<h2 id="toplanan">2. Toplanabilecek veriler</h2>
<p>Örnek olarak:</p>
<ul>
<li>İletişim talepleri ve formlar: ad, soyad, telefon, e-posta, mesaj içeriği;</li>
<li>İşletme kullanıcıları: hesap bilgileri, işlem kayıtları ve destek iletişimi (hizmetin gerektirdiği ölçüde);</li>
<li>Teknik veriler: IP adresi, tarayıcı türü, cihaz bilgisi, oturum ve güvenlik logları, tarih-saat damgaları.</li>
</ul>
<h2 id="kullanim">3. Kullanım amaçları</h2>
<ul>
<li>Hizmetleri sunmak ve geliştirmek;</li>
<li>Güvenlik, dolandırıcılık önleme ve yetkisiz erişimi engellemek;</li>
<li>Yasal yükümlülükleri yerine getirmek;</li>
<li>İletişim ve destek taleplerini yanıtlamak;</li>
<li>Açık rızanız varsa pazarlama veya bilgilendirme (ayrı onay mekanizmalarına tabi).</li>
</ul>
<h2 id="hukuki-dayanak">4. Hukuki dayanak</h2>
<p>İşleme faaliyetleri; KVKK ve ilgili mevzuat kapsamında; açık rıza, sözleşmenin ifası, hukuki yükümlülük veya meşru menfaat gibi sebeplerden birine dayanır.</p>
<h2 id="cerez">5. Çerezler ve benzeri teknolojiler</h2>
<p>Site performansı, oturum yönetimi veya analitik için çerezler veya benzeri teknolojiler kullanılabilir. Tarayıcı ayarlarınızdan çerezleri kısıtlayabilirsiniz; bu durumda bazı özellikler sınırlı kalabilir. Analitik veya reklam çerezleri için ayrıntılı bilgi ve tercihleriniz, çerez bildirimi veya araç sağlayıcıları üzerinden yönetilebilir.</p>
<h2 id="paylasim">6. Üçüncü taraflarla paylaşım</h2>
<p>Barındırma, e-posta, analitik, ödeme veya güvenlik sağlayıcıları gibi iş ortaklarıyla, sözleşme ve mevzuata uygun şekilde ve veri minimizasyonu ilkesiyle paylaşım yapılabilir. Aktarım yurt dışına yapılıyorsa KVKK’nın öngördüğü şartlar aranır.</p>
<h2 id="guvenlik">7. Güvenlik</h2>
<p>Kişisel verilerin korunması için uygun teknik ve idari tedbirler uygulanır; ancak internetin doğası gereği mutlak güvenlik garanti edilemez.</p>
<h2 id="saklama">8. Saklama</h2>
<p>Veriler, işleme amacının gerektirdiği süre ve yasal saklama süreleri kadar muhafaza edilir; süre sonunda silinir veya anonimleştirilir.</p>
<h2 id="haklar">9. Haklarınız</h2>
<p>KVKK kapsamındaki haklarınız için Aydınlatma Metni’ne (“/legal/kvkk”) bakın. Ayrıca ilgili mevzuat çerçevesinde şikâyet hakkınız saklıdır.</p>
<h2 id="cocuklar">10. Çocukların gizliliği</h2>
<p>Hizmetlerimiz genel olarak işletme müşterilerine yöneliktir. Bilerek çocuklardan veri toplamayı hedeflemiyoruz; ebeveyn veya vasilerden talep edilmeyen çocuk verisi fark edilirse silinmesi için bizimle iletişime geçilebilir.</p>
<h2 id="degisiklik">11. Politika değişiklikleri</h2>
<p>Bu politikayı güncelleyebiliriz. Güncel sürüm bu sayfada yayınlanır; önemli değişiklikler mümkün olduğunca bildirilir.</p>
<h2 id="iletisim">12. İletişim</h2>
<p>Gizlilik ve kişisel verilerle ilgili talepleriniz için web sitesindeki iletişim kanalları kullanılabilir.</p>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
