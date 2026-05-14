-- Add tagline to worker_profiles for business card
ALTER TABLE worker_profiles
    ADD COLUMN IF NOT EXISTS tagline VARCHAR(100);
