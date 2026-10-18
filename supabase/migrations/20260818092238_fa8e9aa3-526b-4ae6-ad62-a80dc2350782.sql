-- progress_events: link to content for mistake lists
ALTER TABLE public.progress_events ADD COLUMN IF NOT EXISTS content_id uuid;
CREATE INDEX IF NOT EXISTS progress_events_user_wrong_idx ON public.progress_events (user_id, is_correct, created_at DESC);

-- uniqueness to prevent duplicates
CREATE UNIQUE INDEX IF NOT EXISTS questions_subject_prompt_key ON public.questions (subject_id, prompt);
CREATE UNIQUE INDEX IF NOT EXISTS flashcards_subject_front_key ON public.flashcards (subject_id, front);
CREATE UNIQUE INDEX IF NOT EXISTS match_pairs_subject_left_key ON public.match_pairs (subject_id, left_text);

-- content reports
CREATE TABLE IF NOT EXISTS public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('question','flashcard','match_pair')),
  content_id uuid NOT NULL,
  content_preview text,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_reports TO authenticated;
GRANT ALL ON public.content_reports TO service_role;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reports_insert_own" ON public.content_reports FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "reports_select_own_or_admin" ON public.content_reports FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY "reports_admin_update" ON public.content_reports FOR UPDATE TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "reports_admin_delete" ON public.content_reports FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- pending AI content awaiting admin approval
CREATE TABLE IF NOT EXISTS public.pending_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'question' CHECK (kind IN ('question','flashcard','match_pair')),
  topic text,
  prompt text NOT NULL,
  options jsonb,
  correct_index integer DEFAULT 0,
  explanation text,
  answer text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pending_content TO authenticated;
GRANT ALL ON public.pending_content TO service_role;
ALTER TABLE public.pending_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pending_admin_all" ON public.pending_content FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS content_reports_touch ON public.content_reports;
CREATE TRIGGER content_reports_touch BEFORE UPDATE ON public.content_reports FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS pending_content_touch ON public.pending_content;
CREATE TRIGGER pending_content_touch BEFORE UPDATE ON public.pending_content FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();