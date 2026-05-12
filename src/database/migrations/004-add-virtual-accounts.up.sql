-- Virtual accounts table for Squad integration
CREATE TABLE IF NOT EXISTS virtual_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    customer_identifier VARCHAR(255) NOT NULL UNIQUE,
    virtual_account_number VARCHAR(50) NOT NULL,
    virtual_account_name VARCHAR(255) NOT NULL,
    bank_name VARCHAR(100) NOT NULL,
    bank_code VARCHAR(10),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE INDEX idx_virtual_accounts_user_id ON virtual_accounts(user_id);
CREATE INDEX idx_virtual_accounts_customer_identifier ON virtual_accounts(customer_identifier);
CREATE INDEX idx_virtual_accounts_account_number ON virtual_accounts(virtual_account_number);
