ALTER TABLE virtual_accounts
    DROP COLUMN IF EXISTS balance,
    DROP COLUMN IF EXISTS total_deposited;

ALTER TABLE escrow_entries
    DROP COLUMN IF EXISTS worker_confirmed,
    DROP COLUMN IF EXISTS customer_confirmed;

DROP INDEX IF EXISTS idx_virtual_accounts_account_number;
