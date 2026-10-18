
-- 1) Profil gizliliği
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_own_or_admin ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.get_leaderboard(_limit integer DEFAULT 50)
RETURNS TABLE (id uuid, full_name text, avatar_url text, points integer, streak integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url, p.points, p.streak
  FROM public.profiles p
  ORDER BY p.points DESC, p.created_at ASC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 50), 1), 200);
$$;

REVOKE ALL ON FUNCTION public.get_leaderboard(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_leaderboard(integer) TO authenticated;

-- 2) Hatalı cevap düzeltmeleri
UPDATE public.questions
SET options = '["25","18","21","24"]'::jsonb,
    correct_index = 1,
    explanation = '6 Mart 2018 değişikliği ile belediye başkanı seçilme yaşı 18''e indirilmiştir.'
WHERE prompt = 'Belediye başkanı seçilme yaşı kaçtır?';

UPDATE public.questions
SET correct_index = 1,
    explanation = 'Mahalli idarelerin özerkliği ilk kez 1961 Anayasası ile düzenlenmiştir.'
WHERE prompt = 'Mahalli idarelerin özerkliği ilk kez hangi anayasa ile düzenlenmiştir?';

-- 3) Saat başı içerik üretimi (yönetici onayına düşer)
SELECT cron.schedule(
  'hourly-pending-questions',
  '5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--fffe3fe5-f29c-466b-9005-ce2fe6ad04d9.lovable.app/api/public/hourly-questions',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '3f0e855dc7854e5c2a744a3b746007768f2d43125d99331c'),
    body := '{}'::jsonb
  );
  $$
);
