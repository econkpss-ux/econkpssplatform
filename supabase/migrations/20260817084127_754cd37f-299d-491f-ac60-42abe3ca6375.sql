
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender text;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, gender)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email,''),'@',1)), NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'gender')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student') ON CONFLICT DO NOTHING;

  IF NEW.email_confirmed_at IS NOT NULL AND lower(NEW.email) = 'kaancolakogullari1@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DELETE FROM public.flashcards a USING public.flashcards b WHERE a.ctid > b.ctid AND a.subject_id = b.subject_id AND a.front = b.front;
DELETE FROM public.questions a USING public.questions b WHERE a.ctid > b.ctid AND a.subject_id = b.subject_id AND a.prompt = b.prompt;
DELETE FROM public.match_pairs a USING public.match_pairs b WHERE a.ctid > b.ctid AND a.subject_id = b.subject_id AND a.left_text = b.left_text;

CREATE UNIQUE INDEX IF NOT EXISTS flashcards_unique_front ON public.flashcards (subject_id, front);
CREATE UNIQUE INDEX IF NOT EXISTS questions_unique_prompt ON public.questions (subject_id, prompt);
CREATE UNIQUE INDEX IF NOT EXISTS match_pairs_unique_left ON public.match_pairs (subject_id, left_text);

INSERT INTO public.flashcards (subject_id, topic, front, back)
SELECT s.id, t.topic, t.q, t.a
FROM public.subjects s,
(VALUES
('Hukukta Yaşlar ve Süreler','Türk vatandaşı ile evlenerek Türk vatandaşlığını kazanmak için en az kaç yıl evli olmak gerekir?','3 yıl'),
('Hukukta Yaşlar ve Süreler','Türk Ceza Kanunu''na göre ceza ehliyeti yaşı kaçtır?','12'),
('Hukukta Yaşlar ve Süreler','Türk Ceza Kanunu''na göre tam ceza ehliyeti yaşı kaçtır?','18'),
('Hukukta Yaşlar ve Süreler','Türk Medeni Kanunu''na göre olağan evlenme yaşı kaçtır?','17'),
('Hukukta Yaşlar ve Süreler','Türk Medeni Kanunu''na göre olağanüstü evlenme yaşı kaçtır?','16'),
('Hukukta Yaşlar ve Süreler','Sağır ve dilsizlerde ceza ehliyeti yaşı kaçta başlar?','15'),
('Hukukta Yaşlar ve Süreler','Sağır ve dilsizlerde tam ceza ehliyeti yaşı kaçta başlar?','21'),
('Hukukta Yaşlar ve Süreler','Vasiyetname yazabilme yaşı kaçtır?','15'),
('Hukukta Yaşlar ve Süreler','Türk hukuk sistemindeki "Kaza-i Rüşt" yaşı kaçtır?','15'),
('Hukukta Yaşlar ve Süreler','Ölüm kaç gün içinde nüfus müdürlüğüne bildirilir?','10 gün'),
('Hukukta Yaşlar ve Süreler','Doğum kaç gün içinde nüfus müdürlüğüne bildirilir?','30 gün'),
('Hukukta Yaşlar ve Süreler','Askerlik hizmeti en az kaç aydır?','6 ay'),
('Kuruluş Sayıları','Vakıflar en az kaç kişi ile kurulur?','1'),
('Kuruluş Sayıları','Kooperatifler en az kaç kişi ile kurulur?','7'),
('Kuruluş Sayıları','Şirketler en az kaç kişi ile kurulur?','1'),
('Kuruluş Sayıları','Dernekler en az kaç kişi ile kurulur?','7'),
('Kuruluş Sayıları','Sendikalar en az kaç kişi ile kurulur?','7'),
('Kuruluş Sayıları','Aday memurluk süresi en az kaç yıldır?','1 yıl'),
('Kuruluş Sayıları','Aday memurluk süresi en fazla kaç yıldır?','2 yıl'),
('Anayasa Tarihi','Türkiye Cumhuriyeti hangi yıl çok partili siyasi hayata geçmiştir?','1946'),
('Anayasa Tarihi','Tek yumuşak ve çerçeve anayasa hangisidir?','1921 Anayasası'),
('Anayasa Tarihi','Türk tarihinin en sert ve kazuistik anayasası hangisidir?','1982 Anayasası'),
('Anayasa Tarihi','Milli Egemenlik ilkesini kabul eden ilk anayasa hangisidir?','1921 Anayasası'),
('Anayasa Tarihi','Başkentin "Ankara" olduğu hükmü ilk kez hangi anayasada yer almıştır?','1924 Anayasası'),
('Anayasa Tarihi','Başkentin "Ankara" olduğu hüküm ilk kez hangi anayasada değiştirilemez hükümler arasına alınmıştır?','1982 Anayasası'),
('Anayasa Tarihi','Atatürk İlkeleri ilk kez hangi anayasada yer almıştır?','1924 Anayasası (1937 değişikliği)'),
('Anayasa Tarihi','Kadınlara belediye seçimlerine katılma ve muhtar olabilme hakkı ilk kez hangi anayasa ile tanınmıştır?','1924 Anayasası'),
('Anayasa Tarihi','1924 Anayasası''nda kadınlara seçme ve seçilme hakkı hangi yıl verilmiştir?','1934'),
('Anayasa Tarihi','Gizli oy açık sayım ve döküm ilkelerine dayalı ilk seçim hangi yıl yapılmıştır?','1950'),
('Anayasa Tarihi','Sosyal devlet ilkesi ilk kez hangi anayasa ile benimsenmiştir?','1961 Anayasası'),
('Anayasa Tarihi','Referandum ile kabul edilen ilk anayasa hangisidir?','1961 Anayasası'),
('Anayasa Tarihi','Çağdaş anlamda dünyanın ilk yazılı anayasası hangisidir?','1787 ABD Anayasası'),
('Anayasa Tarihi','Türkiye Cumhuriyeti''nin ilk anayasası hangisidir?','1924 Anayasası'),
('Anayasa Tarihi','"Başlangıç Kısmı" ilk defa hangi anayasada yer almıştır?','1961 Anayasası'),
('Anayasa Tarihi','Kuvvetler ayrılığı ilkesi ilk kez hangi anayasa ile benimsenmiştir?','1961 Anayasası'),
('Anayasa Tarihi','Türk tarihinin ilk anayasası hangisidir?','Kanun-i Esasi (1876)'),
('Anayasa Tarihi','Olağanüstü halleri düzenleyen ilk anayasa hangisidir?','1961 Anayasası'),
('Anayasa Tarihi','Siyasi parti kurma hakkı ilk kez hangi anayasa ile tanınmıştır?','1961 Anayasası'),
('Anayasa Tarihi','Anayasa Mahkemesi ilk kez hangi anayasa ile kurulmuştur?','1961 Anayasası'),
('Anayasa Tarihi','Mahalli idarelerin özerkliği ilk kez hangi anayasa ile düzenlenmiştir?','1982 Anayasası'),
('Anayasa Tarihi','Türk hukuk sistemindeki çift meclisli anayasalar hangileridir?','1876 ve 1961 Anayasaları'),
('Anayasa Tarihi','Yerel yönetimlere geniş yetki tanıyan ve devlet başkanlığı makamına yer vermeyen anayasa hangisidir?','1921 Anayasası'),
('Anayasa Tarihi','"Devletin dini İslam''dır" ibaresi hangi anayasa döneminde kaldırılmıştır?','1924 Anayasası (1928)'),
('Anayasa Tarihi','Laiklik ilkesi hangi anayasaya eklenmiştir?','1924 Anayasası (1937)'),
('Anayasa Tarihi','En uzun süre (36 yıl) yürürlükte kalan anayasa hangisidir?','1924 Anayasası'),
('Anayasa Tarihi','1921 Anayasası''nda seçimler kaç yılda bir yapılırdı?','2 yılda bir'),
('Anayasa Tarihi','1924 Anayasası''nda seçimler kaç yılda bir yapılırdı?','4 yılda bir'),
('Anayasa Tarihi','Devlet Denetleme Kurulu hangi anayasa ile kurulmuştur?','1982 Anayasası'),
('Anayasa Tarihi','Hakimler ve Savcılar Yüksek Kurulu hangi anayasa ile kurulmuştur?','1982 Anayasası'),
('Anayasa Tarihi','Cumhurbaşkanlığı Genel Sekreterliği hangi anayasa ile kurulmuştur?','1982 Anayasası'),
('Anayasa Tarihi','Çok partili hayata hangi anayasa döneminde geçilmiştir?','1924 Anayasası'),
('Anayasa Tarihi','Milli Güvenlik Kurulu hangi anayasa ile kurulmuştur?','1961 Anayasası'),
('Anayasa Tarihi','Yüksek Seçim Kurulu hangi anayasa ile kurulmuştur?','1961 Anayasası'),
('Anayasa Tarihi','Danıştay hangi anayasa ile anayasal kuruluş haline gelmiştir?','1961 Anayasası'),
('Anayasa Tarihi','Çalışma ve sözleşme hürriyeti ilk kez hangi anayasa ile güvence altına alınmıştır?','1961 Anayasası'),
('Seçme ve Seçilme','Türkiye''de seçme yaşı kaçtır?','18'),
('Seçme ve Seçilme','Milletvekili seçilme yaşı kaçtır?','18'),
('Seçme ve Seçilme','Belediye başkanı seçilme yaşı kaçtır?','25'),
('Seçme ve Seçilme','Muhtar olabilmek için en az kaç yaşında olmak gerekir?','18'),
('Seçme ve Seçilme','Cumhurbaşkanı seçilme yaşı kaçtır?','40'),
('Seçme ve Seçilme','Cumhurbaşkanının görev süresi kaç yıldır?','5 yıl'),
('Seçme ve Seçilme','Milletvekilliği görev süresi kaç yıldır?','5 yıl'),
('Seçme ve Seçilme','Yerel seçimler kaç yılda bir yapılır?','5 yılda bir'),
('Seçme ve Seçilme','Cumhurbaşkanı seçilebilmek için gerekli oy oranı nedir?','%50 + 1'),
('Yasama','Türkiye Büyük Millet Meclisi kaç üyeden oluşur?','600'),
('Yasama','Anayasa değişikliği teklifi için TBMM''de kaç milletvekilinin imzası gerekir?','200 (üye tamsayısının 1/3''ü)'),
('Yasama','Anayasa değişikliğinin kabulü için gereken en az oy sayısı kaçtır?','360 (3/5 çoğunluk)'),
('Yasama','Anayasa değişikliğinin doğrudan (halkoyuna sunulmadan) kesinleşmesi için gereken oy sayısı kaçtır?','400 (2/3 çoğunluk)'),
('Yasama','Erken seçim kararı için TBMM''de kaç milletvekilinin oyu gerekir?','360'),
('Yasama','TBMM''de toplantı yeter sayısı kaçtır?','200'),
('Yasama','TBMM''de karar yeter sayısı kaçtır?','151'),
('Yasama','Bir siyasi partinin TBMM''de grup kurabilmesi için en az kaç milletvekili gerekir?','20'),
('Yasama','Siyasi partilerin Hazine yardımından yararlanabilmesi için en az kaç milletvekili gerekir?','3 (ya da %3 oy)'),
('Yürütme','Cumhurbaşkanı yardımcılarının sayısı için üst sınır var mıdır?','Hayır, sayı Cumhurbaşkanınca belirlenir'),
('Yürütme','Cumhurbaşkanlığı Hükümet Sistemi''nde bakanlıklar nasıl belirlenir?','Cumhurbaşkanlığı kararnamesiyle kurulur ve bakanlar Cumhurbaşkanınca atanır'),
('Yürütme','Olağanüstü hal en fazla ne kadar süreyle ilan edilir?','6 ay (TBMM 4''er ay uzatabilir)'),
('Yargı','Anayasa Mahkemesi üye sayısı kaçtır?','15'),
('Yargı','Anayasa Mahkemesi üyelerinin görev süresi kaç yıldır?','12 yıl'),
('Yargı','Hakimler ve Savcılar Kurulu üye sayısı kaçtır?','13'),
('Yargı','Sayıştay''ın görevi nedir?','Kamu kurumlarının gelir, gider ve mallarını TBMM adına denetlemek'),
('Yerel Yönetimler','İl özel idaresi organları kaç yılda bir seçilir?','5 yılda bir'),
('Yerel Yönetimler','Belediye başkanları kaç yılda bir seçilir?','5 yılda bir'),
('Yerel Yönetimler','Köy muhtarları kaç yılda bir seçilir?','5 yılda bir'),
('Yerel Yönetimler','Yerel yönetim birimleri hangileridir?','İl özel idaresi, belediye ve köy')
) AS t(topic,q,a)
WHERE s.slug = 'vatandaslik'
ON CONFLICT (subject_id, front) DO NOTHING;
