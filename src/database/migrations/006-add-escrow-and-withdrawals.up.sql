-- Escrow entries: track funds held per job
CREATE TABLE IF NOT EXISTS escrow_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID UNIQUE NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES users(id),
    worker_id UUID NOT NULL REFERENCES users(id),
    amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'funded', 'released', 'refunded', 'disputed')),
    funded_at TIMESTAMP,
    released_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_escrow_job_id ON escrow_entries(job_id);
CREATE INDEX IF NOT EXISTS idx_escrow_customer_id ON escrow_entries(customer_id);
CREATE INDEX IF NOT EXISTS idx_escrow_worker_id ON escrow_entries(worker_id);
CREATE INDEX IF NOT EXISTS idx_escrow_status ON escrow_entries(status);

-- Withdrawal logs: track payout requests from virtual accounts
CREATE TABLE IF NOT EXISTS withdrawal_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    squad_transaction_reference VARCHAR(255) UNIQUE,
    amount DECIMAL(10,2) NOT NULL,
    bank_code VARCHAR(10) NOT NULL,
    account_number VARCHAR(20) NOT NULL,
    account_name VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'success', 'failed')),
    remarks TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_withdrawal_user_id ON withdrawal_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawal_status ON withdrawal_logs(status);
CREATE INDEX IF NOT EXISTS idx_withdrawal_reference ON withdrawal_logs(squad_transaction_reference);
