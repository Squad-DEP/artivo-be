-- Add wallet balance tracking to virtual_accounts
ALTER TABLE virtual_accounts
    ADD COLUMN IF NOT EXISTS balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS total_deposited DECIMAL(12, 2) NOT NULL DEFAULT 0;

-- Track dual-confirmation for job completion
ALTER TABLE escrow_entries
    ADD COLUMN IF NOT EXISTS worker_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS customer_confirmed BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for fast webhook lookup by account number
CREATE INDEX IF NOT EXISTS idx_virtual_accounts_account_number
    ON virtual_accounts (virtual_account_number);
