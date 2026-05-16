-- Add file_url to education, certifications, and portfolio tables
-- so documents uploaded via R2 can be stored and returned with profile data

ALTER TABLE worker_education      ADD COLUMN IF NOT EXISTS file_url TEXT NULL;
ALTER TABLE worker_certifications ADD COLUMN IF NOT EXISTS file_url TEXT NULL;
ALTER TABLE worker_portfolio      ADD COLUMN IF NOT EXISTS file_url TEXT NULL;

-- Expand the document_type CHECK constraint to include education, certification, portfolio
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_document_type_check;
ALTER TABLE documents ADD CONSTRAINT documents_document_type_check
    CHECK (document_type IN ('profile_photo', 'certificate', 'business_card', 'generated_card', 'education', 'certification', 'portfolio', 'other'));
