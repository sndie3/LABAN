-- Crowdsourced road reports table for LABAN
-- Stores status per road segment with start/end coordinates and region

-- Create table
CREATE TABLE IF NOT EXISTS public.road_reports (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  region TEXT NOT NULL,
  start_lat DOUBLE PRECISION NOT NULL,
  start_lon DOUBLE PRECISION NOT NULL,
  end_lat DOUBLE PRECISION NOT NULL,
  end_lon DOUBLE PRECISION NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('clear', 'flooded', 'blocked')),
  reporter TEXT NULL,
  notes TEXT NULL
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS road_reports_region_idx ON public.road_reports(region);
CREATE INDEX IF NOT EXISTS road_reports_created_at_idx ON public.road_reports(created_at);

-- Optional: simple composite index to speed up proximity searches by bounding box
-- (Client currently does haversine against route points; bbox can help server-side filters later)
CREATE INDEX IF NOT EXISTS road_reports_bbox_idx ON public.road_reports (
  start_lat, start_lon, end_lat, end_lon
);

-- Example insert
-- INSERT INTO public.road_reports(region, start_lat, start_lon, end_lat, end_lon, status, reporter, notes)
-- VALUES('Luzon', 14.5995, 120.9842, 14.6000, 120.9900, 'flooded', 'Juan D', 'Waist-deep water');

-- =============================================
-- Row Level Security (RLS) and Policies
-- =============================================

-- Enable RLS on the table
ALTER TABLE public.road_reports ENABLE ROW LEVEL SECURITY;

-- Read policy: allow public (anon) and authenticated clients to read road reports
DO $$
BEGIN
  CREATE POLICY "Read road reports (public)" ON public.road_reports
  FOR SELECT
  TO anon, authenticated
  USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Insert policy: only authenticated users can insert new reports
DO $$
BEGIN
  CREATE POLICY "Insert road reports (authenticated)" ON public.road_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- basic checks: require fields to be present; you can harden further later
    region IS NOT NULL
    AND status IN ('clear','flooded','blocked')
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Update/Delete policies (optional): restrict to service_role (Admin/API) if needed
-- Note: service_role bypasses RLS by design, so explicit policies are not strictly required.
-- If you still want explicit policies:
-- DO $$ BEGIN CREATE POLICY "Update road reports (service)" ON public.road_reports FOR UPDATE TO service_role USING (true) WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- DO $$ BEGIN CREATE POLICY "Delete road reports (service)" ON public.road_reports FOR DELETE TO service_role USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;