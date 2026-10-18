ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

UPDATE public.profiles SET approved = true, approved_at = now() WHERE approved = false;

CREATE TABLE IF NOT EXISTS public.user_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sender_id uuid,
  subject text NOT NULL,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.user_messages TO authenticated;
GRANT INSERT, DELETE ON public.user_messages TO authenticated;
GRANT ALL ON public.user_messages TO service_role;

ALTER TABLE public.user_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select_own_or_admin" ON public.user_messages
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "messages_update_own_or_admin" ON public.user_messages
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (user_id = auth.uid() OR public.is_admin(auth.uid()));

CREATE POLICY "messages_admin_insert" ON public.user_messages
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "messages_admin_delete" ON public.user_messages
  FOR DELETE TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE TRIGGER user_messages_touch BEFORE UPDATE ON public.user_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS user_messages_user_idx ON public.user_messages (user_id, created_at DESC);