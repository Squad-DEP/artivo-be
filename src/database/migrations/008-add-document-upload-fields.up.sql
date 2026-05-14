ALTER TABLE documents
    ADD COLUMN IF NOT EXISTS file_key VARCHAR(500),
    ADD COLUMN IF NOT EXISTS upload_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (upload_status IN ('pending', 'uploaded', 'failed'));

CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(upload_status);
