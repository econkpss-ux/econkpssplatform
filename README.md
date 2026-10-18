# EconKPSS

Proje Adı: EconKPSS

Proje Vizyonu ve Tanımı
EconKPSS; KPSS hazırlık sürecini stresli bir ezber rutini olmaktan çıkarıp eğlenceli, dinamik ve etkileşimli bir deneyime dönüştürmeyi hedefleyen yeni nesil, web tabanlı bir eğitim platformudur. Amacımız, oyunlaştırma (gamification) dinamiklerini eğitimle mükemmel bir şekilde harmanlayarak Türkiye'nin en iyi, en çok tercih edilen ve en yenilikçi KPSS sistemini inşa etmektir.

1. İnteraktif Öğrenme ve Oyunlaştırma (Gamification) Modülleri
   Sistem, klasik test çözme yöntemlerinin ötesine geçerek kullanıcıların sıkılmadan, eğlenerek öğrenmesini sağlayacak entegre araçlarla donatılacaktır:

Eşleştirme ve Birleştirme Oyunları: Özellikle Tarih, Coğrafya ve Vatandaşlık gibi dersler için sürükle-bırak konseptli, akılda kalıcılığı artıran eşleştirme egzersizleri.

Akıllı Bilgi Kartları (Flashcards): Konu tekrarlarını hızlandıran, kullanıcının doğru/yanlış cevaplarına göre algoritması şekillenen arkalı-önlü dijital hafıza kartları.

Oyunlaştırılmış Soru Bankası: İlerleme kaydettikçe rozetler kazandıran, seviye atlatan ve öğrenmeyi ödüllendiren yeni nesil soru çözüm panelleri.

2. Tasarım (UI/UX) ve Kullanıcı Deneyimi

Özgün ve Çarpıcı Tema: Tasarım, sıradan eğitim sitelerinden tamamen farklı, modern ve vizyoner bir çizgiye sahip olacaktır. Paylaşılan referans temaların hissini yakalayan ancak asla bir kopyası olmayan; tamamen yaratıcı, motivasyon artırıcı ve her kesimin estetik bulacağı benzersiz bir arayüz tasarlanacaktır.

Kusursuz Kullanılabilirlik: Kullanıcıları yormayan, karmaşadan uzak, hem bilgisayar hem de mobil cihazlarda (responsive) mükemmel çalışan akıcı bir deneyim sunulacaktır.

3. Üyelik Sistemi ve Yönetim (Admin) Paneli

Kullanıcı Kayıt Sistemi: Öğrencilerin kolayca hesap oluşturup platforma dahil olabileceği, kendi çalışma istatistiklerini ve ilerlemelerini takip edebileceği kişiselleştirilmiş öğrenci panelleri.

Kurucu Yönetici (Super Admin): Platformun en üst düzey yönetim ve denetim yetkisi doğrudan kaancolakogullari1@gmail.com e-posta adresine tanımlanacaktır. Bu hesap; tüm sistem ayarlarını, kullanıcıları, içerikleri ve platformun genel akışını yönetecek tam yetkili kontrol paneline sahip olacaktır.

Sonuç Hedefi:
EconKPSS, yenilikçi altyapısı ve kullanıcı dostu arayüzü ile KPSS hazırlığında standartları yeniden belirleyen, sektörün açık ara en iyi eğitim platformu olacaktır.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://econkpss.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/fffe3fe5-f29c-466b-9005-ce2fe6ad04d9).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Daily administrator summary

The GitHub Actions workflow emails the previous day's platform metrics every day at
07:15 Türkiye time. It sends to administrator accounts and
`kaancolakogullari1@gmail.com`. To enable delivery, configure these server-side
environment variables in Lovable Cloud:

- `RESEND_API_KEY`: Resend API key.
- `RESEND_FROM_EMAIL`: sender address verified with Resend.
- `DAILY_SUMMARY_SECRET`: a strong random secret used to authorize the scheduled request.

Add the same `DAILY_SUMMARY_SECRET` as a GitHub Actions repository secret. Never
commit these values. Use the workflow's **Run workflow** action to test delivery.

## Account deletion

Apply the SQL migration in `supabase/migrations/20261015030000_account_deletion_requests.sql`
before deploying the account-deletion flow. Users can request deletion from their profile;
their access is locked immediately, then an email link verifies the request. Administrators
can approve permanent removal or reject the request to restore account access. The confirmation
email uses the Resend configuration above. `APP_URL` is optional and defaults to the live app URL.
