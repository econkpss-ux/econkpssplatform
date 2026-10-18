ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hide_surname boolean NOT NULL DEFAULT true;

CREATE OR REPLACE FUNCTION public.get_leaderboard(_limit integer DEFAULT 50)
 RETURNS TABLE(id uuid, full_name text, avatar_url text, points integer, streak integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id,
    CASE
      WHEN p.hide_surname AND p.full_name IS NOT NULL AND position(' ' in btrim(p.full_name)) > 0
        THEN split_part(btrim(p.full_name), ' ', 1) || ' ' || upper(left(split_part(btrim(p.full_name), ' ', 2), 1)) || '...'
      ELSE p.full_name
    END AS full_name,
    p.avatar_url, p.points, p.streak
  FROM public.profiles p
  ORDER BY p.points DESC, p.created_at ASC
  LIMIT LEAST(GREATEST(COALESCE(_limit, 50), 1), 200);
$function$;