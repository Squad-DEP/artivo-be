-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    logo_url    TEXT,
    sector      VARCHAR(100),
    contact_email VARCHAR(255),
    website     VARCHAR(255),
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Artisan org applications
CREATE TABLE IF NOT EXISTS org_applications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    phone           VARCHAR(30) NOT NULL,
    full_name       VARCHAR(255),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Seed 3 organizations
INSERT INTO organizations (id, name, description, sector, contact_email, website)
VALUES
(
    gen_random_uuid(),
    'Lagos Artisans Cooperative',
    'A collective of over 2,000 skilled tradespeople across Lagos State — from plumbers and electricians to welders and carpenters. Members get access to better job opportunities, group insurance, and financial support.',
    'Cooperative',
    'info@lagosartisans.ng',
    'https://lagosartisans.ng'
),
(
    gen_random_uuid(),
    'Abuja Skills Alliance',
    'Government-backed alliance connecting certified artisans in the FCT with verified clients and corporate contracts. Focused on quality assurance and skill development.',
    'Government / NGO',
    'contact@abujaskills.gov.ng',
    'https://abujaskills.gov.ng'
),
(
    gen_random_uuid(),
    'TradesForce Nigeria',
    'Nigeria''s fastest-growing staffing agency for skilled tradespeople. We match vetted artisans to construction companies, real estate firms, and facility managers nationwide.',
    'Staffing',
    'hello@tradesforce.ng',
    'https://tradesforce.ng'
)
ON CONFLICT DO NOTHING;
