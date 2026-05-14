-- Extended worker profile fields
ALTER TABLE worker_profiles
    ADD COLUMN IF NOT EXISTS hourly_rate      DECIMAL(10,2)   NULL,
    ADD COLUMN IF NOT EXISTS minimum_budget   DECIMAL(10,2)   NULL,
    ADD COLUMN IF NOT EXISTS languages        TEXT[]          NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS availability     VARCHAR(20)     NOT NULL DEFAULT 'available'
                                              CHECK (availability IN ('available', 'busy', 'unavailable')),
    ADD COLUMN IF NOT EXISTS categories       TEXT[]          NOT NULL DEFAULT '{}';

-- Work experience
CREATE TABLE IF NOT EXISTS worker_experience (
    id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title        VARCHAR(255) NOT NULL,
    company      VARCHAR(255) NOT NULL,
    start_year   SMALLINT     NOT NULL,
    end_year     SMALLINT     NULL,
    description  TEXT         NULL,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_worker_experience_user ON worker_experience(user_id);

-- Education
CREATE TABLE IF NOT EXISTS worker_education (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    institution VARCHAR(255) NOT NULL,
    year        SMALLINT     NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_worker_education_user ON worker_education(user_id);

-- Certifications
CREATE TABLE IF NOT EXISTS worker_certifications (
    id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(255) NOT NULL,
    issuer     VARCHAR(255) NOT NULL,
    year       SMALLINT     NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_worker_certifications_user ON worker_certifications(user_id);

-- Portfolio items
CREATE TABLE IF NOT EXISTS worker_portfolio (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title       VARCHAR(255) NOT NULL,
    description TEXT         NULL,
    image_url   TEXT         NULL,
    images      TEXT[]       NOT NULL DEFAULT '{}',
    category    VARCHAR(100) NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_worker_portfolio_user ON worker_portfolio(user_id);
