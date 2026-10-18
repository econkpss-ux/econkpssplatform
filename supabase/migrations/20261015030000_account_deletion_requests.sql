ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deletion_pending boolean NOT NULL DEFAULT false;

CREATE TABLE public.account_deletion_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text,
  token_hash text,
  status text NOT NULL DEFAULT 'pending_verification'
    CHECK (status IN ('pending_verification', 'pending_approval', 'rejected', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at timestamptz
);

CREATE UNIQUE INDEX account_deletion_requests_one_open_per_user
  ON public.account_deletion_requests (user_id)
  WHERE status IN ('pending_verification', 'pending_approval');
CREATE INDEX account_deletion_requests_queue_idx
  ON public.account_deletion_requests (status, created_at DESC);
CREATE INDEX account_deletion_requests_token_idx
  ON public.account_deletion_requests (token_hash)
  WHERE token_hash IS NOT NULL;

ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.account_deletion_requests TO authenticated;
GRANT ALL ON public.account_deletion_requests TO service_role;

CREATE OR REPLACE FUNCTION public.is_account_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT NOT profiles.deletion_pending FROM public.profiles WHERE profiles.id = _user_id),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.is_account_active(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_account_active(uuid) TO authenticated, service_role;

CREATE POLICY account_deletion_requests_admin_read
  ON public.account_deletion_requests
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) AND public.is_account_active(auth.uid()));

CREATE OR REPLACE FUNCTION public.protect_account_deletion_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
     AND (
       (TG_OP = 'INSERT' AND NEW.deletion_pending)
       OR (TG_OP = 'UPDATE' AND NEW.deletion_pending IS DISTINCT FROM OLD.deletion_pending)
     ) THEN
    RAISE EXCEPTION 'The account deletion status can only be changed by the server.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.protect_account_deletion_flag() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER protect_account_deletion_flag
  BEFORE INSERT OR UPDATE OF deletion_pending ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_account_deletion_flag();

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own
  ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() AND public.is_account_active(auth.uid()))
  WITH CHECK (id = auth.uid() AND public.is_account_active(auth.uid()));

DROP POLICY IF EXISTS profiles_admin_update ON public.profiles;
CREATE POLICY profiles_admin_update
  ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) AND public.is_account_active(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) AND public.is_account_active(auth.uid()));

DROP POLICY IF EXISTS user_roles_select_own ON public.user_roles;
CREATE POLICY user_roles_select_own
  ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    public.is_account_active(auth.uid())
    AND (user_id = auth.uid() OR public.is_admin(auth.uid()))
  );

DROP POLICY IF EXISTS progress_select_own ON public.progress_events;
CREATE POLICY progress_select_own
  ON public.progress_events
  FOR SELECT TO authenticated
  USING (
    public.is_account_active(auth.uid())
    AND (user_id = auth.uid() OR public.is_admin(auth.uid()))
  );
DROP POLICY IF EXISTS progress_insert_own ON public.progress_events;
CREATE POLICY progress_insert_own
  ON public.progress_events
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_account_active(auth.uid()));

DROP POLICY IF EXISTS reports_insert_own ON public.content_reports;
CREATE POLICY reports_insert_own
  ON public.content_reports
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_account_active(auth.uid()));
DROP POLICY IF EXISTS reports_select_own_or_admin ON public.content_reports;
CREATE POLICY reports_select_own_or_admin
  ON public.content_reports
  FOR SELECT TO authenticated
  USING (
    public.is_account_active(auth.uid())
    AND (user_id = auth.uid() OR public.is_admin(auth.uid()))
  );
DROP POLICY IF EXISTS reports_admin_update ON public.content_reports;
CREATE POLICY reports_admin_update
  ON public.content_reports
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) AND public.is_account_active(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) AND public.is_account_active(auth.uid()));
DROP POLICY IF EXISTS reports_admin_delete ON public.content_reports;
CREATE POLICY reports_admin_delete
  ON public.content_reports
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) AND public.is_account_active(auth.uid()));

DROP POLICY IF EXISTS messages_select_own_or_admin ON public.user_messages;
CREATE POLICY messages_select_own_or_admin
  ON public.user_messages
  FOR SELECT TO authenticated
  USING (
    public.is_account_active(auth.uid())
    AND (user_id = auth.uid() OR public.is_admin(auth.uid()))
  );
DROP POLICY IF EXISTS messages_update_own_or_admin ON public.user_messages;
CREATE POLICY messages_update_own_or_admin
  ON public.user_messages
  FOR UPDATE TO authenticated
  USING (
    public.is_account_active(auth.uid())
    AND (user_id = auth.uid() OR public.is_admin(auth.uid()))
  )
  WITH CHECK (
    public.is_account_active(auth.uid())
    AND (user_id = auth.uid() OR public.is_admin(auth.uid()))
  );
DROP POLICY IF EXISTS messages_admin_insert ON public.user_messages;
CREATE POLICY messages_admin_insert
  ON public.user_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()) AND public.is_account_active(auth.uid()));
DROP POLICY IF EXISTS messages_admin_delete ON public.user_messages;
CREATE POLICY messages_admin_delete
  ON public.user_messages
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()) AND public.is_account_active(auth.uid()));

DROP POLICY IF EXISTS pending_admin_all ON public.pending_content;
CREATE POLICY pending_admin_all
  ON public.pending_content
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND public.is_account_active(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) AND public.is_account_active(auth.uid()));

DROP POLICY IF EXISTS announcements_admin_write ON public.announcements;
CREATE POLICY announcements_admin_write
  ON public.announcements
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND public.is_account_active(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) AND public.is_account_active(auth.uid()));

DROP POLICY IF EXISTS subjects_admin_write ON public.subjects;
CREATE POLICY subjects_admin_write
  ON public.subjects
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND public.is_account_active(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) AND public.is_account_active(auth.uid()));

DROP POLICY IF EXISTS flashcards_admin_write ON public.flashcards;
CREATE POLICY flashcards_admin_write
  ON public.flashcards
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND public.is_account_active(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) AND public.is_account_active(auth.uid()));

DROP POLICY IF EXISTS questions_admin_write ON public.questions;
CREATE POLICY questions_admin_write
  ON public.questions
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND public.is_account_active(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) AND public.is_account_active(auth.uid()));

DROP POLICY IF EXISTS match_pairs_admin_write ON public.match_pairs;
CREATE POLICY match_pairs_admin_write
  ON public.match_pairs
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()) AND public.is_account_active(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) AND public.is_account_active(auth.uid()));

DROP POLICY IF EXISTS user_login_events_admin_read ON public.user_login_events;
CREATE POLICY user_login_events_admin_read
  ON public.user_login_events
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()) AND public.is_account_active(auth.uid()));

DROP POLICY IF EXISTS site_settings_admin_update ON public.site_settings;
CREATE POLICY site_settings_admin_update
  ON public.site_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin(auth.uid()) AND public.is_account_active(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()) AND public.is_account_active(auth.uid()));
