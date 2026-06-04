-- Migrate preferred_date from varchar to date type
-- First clean up any non-date values to avoid cast errors
UPDATE bookings
SET preferred_date = NULL
WHERE preferred_date IS NOT NULL
  AND preferred_date !~ '^\d{4}-\d{2}-\d{2}$';

-- Alter column type
ALTER TABLE bookings
  ALTER COLUMN preferred_date TYPE date USING preferred_date::date;
