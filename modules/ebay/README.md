# eBay kullanılmış parçalar

Kalıcı sayfa: `/ebay-parcalar`. Ana parça araması tamamlandığında aranan parça
numarasıyla (yoksa parça adı/marka/model ile) sonuçların altında otomatik açılır.
`embed=1` yalnızca iframe içinde otomatik sorgu ve küçük fiyat özeti sağlar.
Varsayılan sıralama `price` (kargo dahil artan). Bağımsız sayfa otomatik sorgulamaz.
Görsel düğmesi `/api/ebay/images?id=...` ile ilanın fotoğraflarını alır; ana sayfada
mevcut yakınlaştırmalı karuselde, bağımsız sayfada ayrı galeride açar.
Sayfa açılınca API sorgusu yapılmaz. Arama formu gönderilince otomobil parçaları
ve aksesuarları (6030) kategorisini sorgular. `/ebay-parcalar?q=04L131501`
adresinde arama kutusu doldurulur; sorgu için yine Parça ara düğmesine basılmalıdır.

Tekrar kullanılabilir servis: `GET /api/ebay/search?q=...&sort=best&page=1`.
Sıralamalar: `best`, `price`, `-price`, `newlyListed`; sayfa boyutu 24.
Browse API `price` / `-price` sıralaması parça + kargo toplamına göre yapılır;
sunucunun döndürdüğü sayfalar bu sırayı korur. Arayüz parça, kargo ve biliniyorsa
toplam fiyatı gösterir. Eksik kargo ücretsiz kabul edilmez. Üstteki istatistikler
yalnızca parça fiyatları üzerinden hesaplanmaya devam eder.
Satıcı adı/profil bağlantısı, geri bildirim puanı ve olumlu geri bildirim yüzdesi
gösterilir. Browse API satıcı genelinde toplam satış adedini sağlamaz; bu alan
`sellerTotalSales: null` olarak döner; satış adedi arayüzde gösterilmez.
Geri bildirim puanı veya ilana ait estimatedSoldQuantity satıcının toplam satışı değildir.
Varsayılan filtreler: conditionIds 3000, BUSINESS, itemLocationCountry DE.
API parametreleri used=false, business=false ve germany=false ile ayrı ayrı kaldırılır.
Pazar EBAY_DE ve otomobil parçaları kategorisi sabittir. Filtreler değişince sonuçlar temizlenir;
yeni arama yalnızca form gönderildiğinde yapılır.
Almanya filtresi ürün konumunu ifade eder; şirketin kayıtlı adresini doğrulamaz.

Sunucu `.env` içindeki `EBAY_PRODUCTION_APP_ID` ve `EBAY_PRODUCTION_CERT_ID` ile
OAuth client_credentials token alır. Trading API URL'si ve eski user token bu
Browse API çağrısında kullanılmaz. Anahtarlar tarayıcıya gönderilmez.
Token süresi dolmadan yenilenir; arama sonuçları bellekte 60 saniye tutulur.
Sayfa ve modül kalıcıdır; ilanlar güncel olarak sorgulanır, kalıcı ilan arşivi tutulmaz.

2026-09-07 tekrar yapılan canlı kontrolde mevcut `.env` anahtarlarıyla otomatik
OAuth token alma ve Production Browse API araması başarılı oldu.
`Scheinwerfer` sorgusu zorunlu filtrelerle 24 ilan döndürdü.
Önceki `unauthorized_client` hatası bu kontrolde tekrarlanmadı.
`.env` anahtarları değiştiğinde çalışan sunucunun yeniden başlatılması gerekir.

Doğrulama: `node --test modules/ebay/client.test.js`.

Resmi referanslar:
- https://developer.ebay.com/api-docs/buy/static/ref-buy-browse-filters.html
- https://developer.ebay.com/develop/guides-v2/authorization#the-client-credentials-grant-flow
