CREATE TABLE IF NOT EXISTS escrow_advance_requests (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id          UUID         NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    worker_id       UUID         NOT NULL REFERENCES users(id),
    customer_id     UUID         NOT NULL REFERENCES users(id),
    amount          DECIMAL(10,2) NOT NULL,
    reason          TEXT,
    status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
    requested_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    approved_at     TIMESTAMPTZ
);
