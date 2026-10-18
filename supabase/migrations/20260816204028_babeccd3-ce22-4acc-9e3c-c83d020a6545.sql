ALTER TABLE public.progress_events ADD COLUMN IF NOT EXISTS topic text;
CREATE INDEX IF NOT EXISTS progress_events_user_subject_idx ON public.progress_events (user_id, subject_id);

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.unschedule('econkpss-daily-content') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'econkpss-daily-content'
);

SELECT cron.schedule(
  'econkpss-daily-content',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url := 'https://project--fffe3fe5-f29c-466b-9005-ce2fe6ad04d9.lovable.app/api/public/daily-content',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', '3f0e855dc7854e5c2a744a3b746007768f2d43125d99331c'),
    body := '{}'::jsonb
  );
  $$
);