CREATE TABLE IF NOT EXISTS worker_bank_accounts (
    id             UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID         NOT NULL UNIQUE REFERENCES users(id),
    account_number VARCHAR(20)  NOT NULL,
    bank_code      VARCHAR(10)  NOT NULL,
    bank_name      VARCHAR(100) NOT NULL,
    account_name   VARCHAR(255) NOT NULL,
    verified       BOOLEAN      NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_worker_bank_accounts_user ON worker_bank_accounts(user_id);
