ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS auto_generated boolean NOT NULL DEFAULT false;
ALTER TABLE public.match_pairs ADD COLUMN IF NOT EXISTS auto_generated boolean NOT NULL DEFAULT false;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS auto_generated boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS flashcards_auto_created_idx ON public.flashcards (auto_generated, created_at DESC);