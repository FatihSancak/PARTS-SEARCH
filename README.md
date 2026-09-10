# TecDoc Parça Arama

ESS veritabanı, Recycle, WMKAT ve eBay üzerinden parça araması yapan yerel web uygulaması.

## Arama akışı

1. Parça ilk olarak ESS veritabanında aranır.
2. ESS sonucu yoksa Recycle otomatik olarak kontrol edilir.
3. ESS ve Recycle boşsa resmi WMKAT logolu **WMKAT'tan ara** düğmesi gösterilir.
4. WMKAT araması yalnızca kullanıcı bu düğmeye bastığında başlar.
5. eBay Parçalar sayfası aynı parça numarasıyla ayrı sekmede açılabilir.

Recycle ve WMKAT otomasyonu Node.js içindeki `playwright-core` ile, bilgisayarda kurulu Microsoft Edge'in Chromium arayüzü üzerinden headless modda çalışır. eBay verileri scraping yerine resmi eBay Browse API üzerinden alınır.

## eBay fiyat analizi

- Tam eşleşme açıkken parça numarası ilan başlığında bağımsız bir değer olarak bulunmalıdır.
- Aranan `q` değeri ilan başlıklarında sarı renkle vurgulanır.
- Önerilen fiyat, hızlı satış fiyatı, medyan ve ortalama yalnızca açık sayfadan değil, eBay'deki tüm sonuç sayfalarından hesaplanır.
- Ürün fiyatına, eBay tarafından verilmişse kargo fiyatı eklenir.
- Kargo fiyatı verilmeyen ilanlar ürün fiyatıyla hesaplamaya katılır ve arayüzde kargo bilgisi olan/olmayan kayıt sayıları ayrı gösterilir.

## Gereksinimler

- Node.js
- Microsoft Edge
- Microsoft SQL Server erişimi
- Recycle ve WMKAT hesap bilgileri
- eBay Production App ID ve Cert ID

## Çalıştırma

`start.bat` dosyasına çift tıklayın veya:

```powershell
node index.js
```

Ardından `http://127.0.0.1:8088` adresini açın. MSSQL bağlantı bilgileri `.env` dosyasından okunur. Uygulamada yalnızca sabit ve parametreli `SELECT` sorguları vardır.

## SQL Sunucusu

`.env` dosyasında aktif profil için `WORK_DB_SERVER`, `WORK_DB_DATABASE`, `WORK_DB_USER` ve `WORK_DB_PASSWORD` alanlarını doldurun. `DB_CONFIG_SOURCE=ENV` olduğunda tek bağlantı kaynağı `.env` dosyasıdır.

Aynı yerel ağdaki bilgisayarlar sunucu bilgisayarının IPv4 adresi üzerinden bağlanabilir: `http://SUNUCU-IP:8088`. Güvenlik duvarı kuralı yalnızca yerel alt ağa izin verir.

İlk intranet kurulumunda `intranet_izni_yonetici.bat` dosyasına çift tıklayın ve Windows yönetici onayını verin. Bu işlem TCP 8088'i yalnızca `LocalSubnet` ve `Private` ağ profiline açar; internet erişimi sağlamaz.
