# TecDoc Parça Arama

`dbo.Gebrauchtteile` tablosunda salt okunur sorgularla arama yapan yerel web uygulaması.

## Çalıştırma

`start.bat` dosyasına çift tıklayın veya:

```powershell
python app.py
```

Ardından `http://127.0.0.1:8088` adresini açın. MSSQL bağlantı bilgileri çalışma anında üst dizindeki `1a.accdb` dosyasından okunur; parola proje dosyalarına kaydedilmez. Uygulamada yalnızca sabit ve parametreli `SELECT` sorguları vardır.

## Farklı SQL sunucusu

`db_config.json` dosyasını düzenleyip `enabled` değerini `true` yapın. `server`, `database`, `user` ve `password` alanlarını doldurun. Windows kimlik doğrulaması için `trusted_connection` değerini `true` yapabilirsiniz. `enabled: false` olduğunda mevcut Access ODBC kaydı kullanılır.

Aynı yerel ağdaki bilgisayarlar sunucu bilgisayarın IPv4 adresi üzerinden bağlanabilir: `http://SUNUCU-IP:8088`. Güvenlik duvarı kuralı yalnızca yerel alt ağa izin verir.

İlk intranet kurulumunda `intranet_izni_yonetici.bat` dosyasına çift tıklayın ve Windows yönetici onayını verin. Bu işlem TCP 8088'i yalnızca `LocalSubnet` ve `Private` ağ profiline açar; internet erişimi sağlamaz.
