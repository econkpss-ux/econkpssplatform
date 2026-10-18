ALTER TABLE public.site_settings
  ADD COLUMN maintenance_title text NOT NULL DEFAULT 'Kısa bir bakım molası'
    CHECK (char_length(maintenance_title) BETWEEN 1 AND 100);
