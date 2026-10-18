ALTER TABLE public.pending_content ADD COLUMN IF NOT EXISTS difficulty integer NOT NULL DEFAULT 2;
ALTER TABLE public.pending_content ADD COLUMN IF NOT EXISTS ai_check jsonb;