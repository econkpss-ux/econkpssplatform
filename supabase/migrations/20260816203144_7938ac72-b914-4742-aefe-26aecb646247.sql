ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS topic text;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS topic text;
ALTER TABLE public.match_pairs ADD COLUMN IF NOT EXISTS topic text;