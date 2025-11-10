-- Add accessible vehicles recommendations to help_requests
-- Allows civilians to specify what vehicles can enter the area

ALTER TABLE public.help_requests
  ADD COLUMN IF NOT EXISTS access_vehicles TEXT[];

-- Optional: constrain values via a check (commented for flexibility)
-- ALTER TABLE public.help_requests
--   ADD CONSTRAINT help_requests_access_vehicles_valid
--   CHECK (
--     access_vehicles IS NULL OR
--     (
--       array_length(access_vehicles, 1) IS NOT NULL AND
--       NOT EXISTS (
--         SELECT 1 FROM unnest(access_vehicles) v
--         WHERE v NOT IN ('car','motorcycle','foot','boat','truck')
--       )
--     )
--   );