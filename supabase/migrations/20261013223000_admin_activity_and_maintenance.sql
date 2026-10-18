CREATE TABLE public.user_login_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  logged_in_at timestamptz NOT NULL
);

CREATE INDEX user_login_events_user_logged_in_at_idx
  ON public.user_login_events (user_id, logged_in_at DESC);
CREATE INDEX user_login_events_logged_in_at_idx
  ON public.user_login_events (logged_in_at DESC);
CREATE INDEX IF NOT EXISTS progress_events_created_at_user_idx
  ON public.progress_events (created_at DESC, user_id);

ALTER TABLE public.user_login_events ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.user_login_events TO authenticated;
GRANT ALL ON public.user_login_events TO service_role;

CREATE POLICY "user_login_events_admin_read"
  ON public.user_login_events
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.log_user_sign_in()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.last_sign_in_at IS NOT NULL
     AND NEW.last_sign_in_at IS DISTINCT FROM OLD.last_sign_in_at THEN
    INSERT INTO public.user_login_events (user_id, logged_in_at)
    VALUES (NEW.id, NEW.last_sign_in_at);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.log_user_sign_in() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER on_auth_user_sign_in
  AFTER UPDATE OF last_sign_in_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
  EXECUTE FUNCTION public.log_user_sign_in();

INSERT INTO public.user_login_events (user_id, logged_in_at)
SELECT id, last_sign_in_at
FROM auth.users
WHERE last_sign_in_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.get_admin_user_activity(_since timestamptz)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  last_login_at timestamptz,
  last_activity_kind text,
  last_activity_at timestamptz,
  activity_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Administrator access required.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH latest_logins AS (
    SELECT DISTINCT ON (events.user_id)
      events.user_id,
      events.logged_in_at
    FROM public.user_login_events AS events
    ORDER BY events.user_id, events.logged_in_at DESC
  ),
  recent_activity AS (
    SELECT
      events.user_id,
      count(*) AS activity_count,
      (array_agg(events.kind ORDER BY events.created_at DESC))[1] AS activity_kind,
      max(events.created_at) AS activity_at
    FROM public.progress_events AS events
    WHERE events.created_at >= _since
    GROUP BY events.user_id
  )
  SELECT
    profiles.id,
    profiles.full_name,
    profiles.email,
    latest_logins.logged_in_at,
    recent_activity.activity_kind,
    recent_activity.activity_at,
    COALESCE(recent_activity.activity_count, 0)
  FROM public.profiles AS profiles
  LEFT JOIN latest_logins ON latest_logins.user_id = profiles.id
  LEFT JOIN recent_activity ON recent_activity.user_id = profiles.id
  ORDER BY GREATEST(
    COALESCE(latest_logins.logged_in_at, '-infinity'::timestamptz),
    COALESCE(recent_activity.activity_at, '-infinity'::timestamptz)
  ) DESC, profiles.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_admin_user_activity(timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_user_activity(timestamptz) TO authenticated;

CREATE TABLE public.site_settings (
  id smallint PRIMARY KEY CHECK (id = 1),
  maintenance_enabled boolean NOT NULL DEFAULT false,
  maintenance_message text NOT NULL DEFAULT 'Sitemizde planlı bakım çalışması yapılıyor. Kısa süre içinde tekrar buradayız.'
    CHECK (char_length(maintenance_message) BETWEEN 1 AND 300),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.site_settings (id) VALUES (1);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.site_settings TO anon, authenticated;
GRANT UPDATE ON public.site_settings TO authenticated;
GRANT ALL ON public.site_settings TO service_role;

CREATE POLICY "site_settings_public_read"
  ON public.site_settings
  FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "site_settings_admin_update"
  ON public.site_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER site_settings_touch
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1
       FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'site_settings'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.site_settings;
  END IF;
END;
$$;
