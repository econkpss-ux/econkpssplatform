-- ROLES
CREATE TYPE public.app_role AS ENUM ('super_admin','admin','student');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text,
  full_name text,
  avatar_url text,
  points integer NOT NULL DEFAULT 0,
  streak integer NOT NULL DEFAULT 0,
  last_active date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin','super_admin'));
$$;

CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

-- SIGNUP TRIGGER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email,''),'@',1)), NEW.raw_user_meta_data->>'avatar_url')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'student') ON CONFLICT DO NOTHING;

  IF NEW.email_confirmed_at IS NOT NULL AND lower(NEW.email) = 'kaancolakogullari1@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.grant_super_admin_on_confirm()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.email_confirmed_at IS NOT NULL AND lower(NEW.email) = 'kaancolakogullari1@gmail.com' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'super_admin') ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_confirmed AFTER UPDATE OF email_confirmed_at ON auth.users
FOR EACH ROW WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
EXECUTE FUNCTION public.grant_super_admin_on_confirm();

-- CONTENT
CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  color text NOT NULL DEFAULT 'blue',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.subjects TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.subjects TO authenticated;
GRANT ALL ON public.subjects TO service_role;
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subjects_read_all" ON public.subjects FOR SELECT USING (true);
CREATE POLICY "subjects_admin_write" ON public.subjects FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  front text NOT NULL,
  back text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flashcards TO authenticated;
GRANT ALL ON public.flashcards TO service_role;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "flashcards_read" ON public.flashcards FOR SELECT TO authenticated USING (true);
CREATE POLICY "flashcards_admin_write" ON public.flashcards FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  prompt text NOT NULL,
  options jsonb NOT NULL,
  correct_index integer NOT NULL DEFAULT 0,
  explanation text,
  difficulty integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "questions_read" ON public.questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "questions_admin_write" ON public.questions FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.match_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  left_text text NOT NULL,
  right_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.match_pairs TO authenticated;
GRANT ALL ON public.match_pairs TO service_role;
ALTER TABLE public.match_pairs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "match_pairs_read" ON public.match_pairs FOR SELECT TO authenticated USING (true);
CREATE POLICY "match_pairs_admin_write" ON public.match_pairs FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TABLE public.progress_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  kind text NOT NULL,
  is_correct boolean,
  points integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.progress_events TO authenticated;
GRANT ALL ON public.progress_events TO service_role;
ALTER TABLE public.progress_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "progress_select_own" ON public.progress_events FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "progress_insert_own" ON public.progress_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE TABLE public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.announcements TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "announcements_read" ON public.announcements FOR SELECT TO authenticated USING (true);
CREATE POLICY "announcements_admin_write" ON public.announcements FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- POINT AWARDING
CREATE OR REPLACE FUNCTION public.apply_progress_points()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles SET points = points + NEW.points, last_active = current_date, updated_at = now() WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;
CREATE TRIGGER progress_points AFTER INSERT ON public.progress_events FOR EACH ROW EXECUTE FUNCTION public.apply_progress_points();

-- SEED
INSERT INTO public.subjects (slug, name, description, color, sort_order) VALUES
 ('tarih','Tarih','Osmanlı, İnkılap ve Çağdaş Türk Tarihi','amber',1),
 ('cografya','Coğrafya','Türkiye ve dünya coğrafyası','emerald',2),
 ('vatandaslik','Vatandaşlık','Anayasa, temel hukuk ve güncel bilgiler','blue',3),
 ('matematik','Matematik','Temel matematik ve problemler','violet',4),
 ('turkce','Türkçe','Dil bilgisi, anlatım ve paragraf','rose',5);

INSERT INTO public.flashcards (subject_id, front, back)
SELECT id, 'Tanzimat Fermanı hangi yıl ilan edildi?', '1839 yılında Sultan Abdülmecid döneminde ilan edildi.' FROM public.subjects WHERE slug='tarih';
INSERT INTO public.flashcards (subject_id, front, back)
SELECT id, 'Kurtuluş Savaşı''nın ilk cephesi hangisidir?', 'Doğu Cephesi (Kâzım Karabekir komutasında).' FROM public.subjects WHERE slug='tarih';
INSERT INTO public.flashcards (subject_id, front, back)
SELECT id, 'Türkiye''nin en uzun akarsuyu hangisidir?', 'Kızılırmak (yaklaşık 1355 km).' FROM public.subjects WHERE slug='cografya';
INSERT INTO public.flashcards (subject_id, front, back)
SELECT id, 'Türkiye''nin en yüksek dağı?', 'Ağrı Dağı (5137 m).' FROM public.subjects WHERE slug='cografya';
INSERT INTO public.flashcards (subject_id, front, back)
SELECT id, 'TBMM''nin görev süresi kaç yıldır?', '5 yıl.' FROM public.subjects WHERE slug='vatandaslik';
INSERT INTO public.flashcards (subject_id, front, back)
SELECT id, 'Bir üçgenin iç açıları toplamı?', '180 derece.' FROM public.subjects WHERE slug='matematik';
INSERT INTO public.flashcards (subject_id, front, back)
SELECT id, 'Ünsüz yumuşaması nedir?', 'p, ç, t, k ünsüzlerinin ünlüyle başlayan ek aldığında b, c, d, g''ye dönüşmesidir.' FROM public.subjects WHERE slug='turkce';

INSERT INTO public.questions (subject_id, prompt, options, correct_index, explanation)
SELECT id, 'Cumhuriyet hangi tarihte ilan edilmiştir?', '["29 Ekim 1923","23 Nisan 1920","30 Ağustos 1922","19 Mayıs 1919"]'::jsonb, 0, 'Cumhuriyet 29 Ekim 1923''te ilan edilmiştir.' FROM public.subjects WHERE slug='tarih';
INSERT INTO public.questions (subject_id, prompt, options, correct_index, explanation)
SELECT id, 'Lozan Barış Antlaşması hangi yıl imzalandı?', '["1920","1921","1923","1925"]'::jsonb, 2, '24 Temmuz 1923''te imzalanmıştır.' FROM public.subjects WHERE slug='tarih';
INSERT INTO public.questions (subject_id, prompt, options, correct_index, explanation)
SELECT id, 'Türkiye''nin yüzölçümü bakımından en büyük ili hangisidir?', '["Sivas","Konya","Ankara","Erzurum"]'::jsonb, 1, 'Konya yaklaşık 41.000 km² ile en büyük ilimizdir.' FROM public.subjects WHERE slug='cografya';
INSERT INTO public.questions (subject_id, prompt, options, correct_index, explanation)
SELECT id, 'Karadeniz ikliminin en belirgin özelliği nedir?', '["Her mevsim yağışlı olması","Yazların kurak geçmesi","Kışların çok sıcak olması","Yıllık yağışın çok az olması"]'::jsonb, 0, 'Karadeniz iklimi her mevsim yağışlıdır.' FROM public.subjects WHERE slug='cografya';
INSERT INTO public.questions (subject_id, prompt, options, correct_index, explanation)
SELECT id, '1982 Anayasası''na göre yasama yetkisi kime aittir?', '["Cumhurbaşkanı","TBMM","Bakanlar Kurulu","Anayasa Mahkemesi"]'::jsonb, 1, 'Yasama yetkisi Türk Milleti adına TBMM''ye aittir.' FROM public.subjects WHERE slug='vatandaslik';
INSERT INTO public.questions (subject_id, prompt, options, correct_index, explanation)
SELECT id, 'Aşağıdakilerden hangisi temel hak ve hürriyetlerden değildir?', '["Yaşama hakkı","Kişi dokunulmazlığı","Seçme ve seçilme hakkı","Vergi kaçırma hakkı"]'::jsonb, 3, 'Vergi ödemek bir ödevdir; kaçırmak hak değildir.' FROM public.subjects WHERE slug='vatandaslik';
INSERT INTO public.questions (subject_id, prompt, options, correct_index, explanation)
SELECT id, '3x + 6 = 21 ise x kaçtır?', '["3","5","6","7"]'::jsonb, 1, '3x = 15 → x = 5.' FROM public.subjects WHERE slug='matematik';
INSERT INTO public.questions (subject_id, prompt, options, correct_index, explanation)
SELECT id, 'Bir sayının %20''si 40 ise sayı kaçtır?', '["120","160","200","240"]'::jsonb, 2, '40 / 0,20 = 200.' FROM public.subjects WHERE slug='matematik';
INSERT INTO public.questions (subject_id, prompt, options, correct_index, explanation)
SELECT id, '"Kitabı masanın üstüne koydum." cümlesinde altı çizili olabilecek dolaylı tümleç hangisidir?', '["Kitabı","masanın üstüne","koydum","yok"]'::jsonb, 1, 'Yer bildiren "masanın üstüne" dolaylı tümleçtir.' FROM public.subjects WHERE slug='turkce';
INSERT INTO public.questions (subject_id, prompt, options, correct_index, explanation)
SELECT id, 'Aşağıdaki kelimelerden hangisi yazım bakımından doğrudur?', '["yalnış","yanlız","yalnız","yannız"]'::jsonb, 2, 'Doğru yazım "yalnız"dır.' FROM public.subjects WHERE slug='turkce';

INSERT INTO public.match_pairs (subject_id, left_text, right_text)
SELECT id, 'Malazgirt Savaşı','1071' FROM public.subjects WHERE slug='tarih';
INSERT INTO public.match_pairs (subject_id, left_text, right_text)
SELECT id, 'İstanbul''un Fethi','1453' FROM public.subjects WHERE slug='tarih';
INSERT INTO public.match_pairs (subject_id, left_text, right_text)
SELECT id, 'Cumhuriyetin İlanı','1923' FROM public.subjects WHERE slug='tarih';
INSERT INTO public.match_pairs (subject_id, left_text, right_text)
SELECT id, 'Harf İnkılabı','1928' FROM public.subjects WHERE slug='tarih';
INSERT INTO public.match_pairs (subject_id, left_text, right_text)
SELECT id, 'En kalabalık il','İstanbul' FROM public.subjects WHERE slug='cografya';
INSERT INTO public.match_pairs (subject_id, left_text, right_text)
SELECT id, 'En uzun akarsu','Kızılırmak' FROM public.subjects WHERE slug='cografya';
INSERT INTO public.match_pairs (subject_id, left_text, right_text)
SELECT id, 'En büyük göl','Van Gölü' FROM public.subjects WHERE slug='cografya';
INSERT INTO public.match_pairs (subject_id, left_text, right_text)
SELECT id, 'En yüksek dağ','Ağrı Dağı' FROM public.subjects WHERE slug='cografya';
INSERT INTO public.match_pairs (subject_id, left_text, right_text)
SELECT id, 'Yasama','TBMM' FROM public.subjects WHERE slug='vatandaslik';
INSERT INTO public.match_pairs (subject_id, left_text, right_text)
SELECT id, 'Yürütme','Cumhurbaşkanı' FROM public.subjects WHERE slug='vatandaslik';
INSERT INTO public.match_pairs (subject_id, left_text, right_text)
SELECT id, 'Yargı','Bağımsız Mahkemeler' FROM public.subjects WHERE slug='vatandaslik';

INSERT INTO public.announcements (title, body) VALUES
 ('EconKPSS''e hoş geldin!','Bilgi kartları, eşleştirme oyunları ve oyunlaştırılmış soru bankası ile çalışmaya hemen başla.'),
 ('Yeni içerikler eklendi','Tarih ve Coğrafya derslerine yeni sorular ve eşleştirme setleri eklendi.');