# TecDoc Parca Arama

`dbo.Gebrauchtteile` tablosunda salt okunur sorgularla arama yapan yerel web uygulamasi.

## Calistirma

`start.bat` dosyasina cift tiklayin veya:

```powershell
node index.js
```

Ardindan `http://127.0.0.1:8088` adresini acin. MSSQL baglanti bilgileri `.env` dosyasindan okunur. Uygulamada yalnizca sabit ve parametreli `SELECT` sorgulari vardir.

## SQL Sunucusu

`.env` dosyasinda aktif profil icin `WORK_DB_SERVER`, `WORK_DB_DATABASE`, `WORK_DB_USER` ve `WORK_DB_PASSWORD` alanlarini doldurun. `DB_CONFIG_SOURCE=ENV` oldugunda tek baglanti kaynagi `.env` dosyasidir.

Ayni yerel agdaki bilgisayarlar sunucu bilgisayarinin IPv4 adresi uzerinden baglanabilir: `http://SUNUCU-IP:8088`. Guvenlik duvari kurali yalnizca yerel alt aga izin verir.

Ilk intranet kurulumunda `intranet_izni_yonetici.bat` dosyasina cift tiklayin ve Windows yonetici onayini verin. Bu islem TCP 8088'i yalnizca `LocalSubnet` ve `Private` ag profiline acar; internet erisimi saglamaz.
