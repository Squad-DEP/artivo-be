ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20) NOT NULL DEFAULT 'online';
-- pending_payment: job created, customer has not yet paid (online flow)
-- in_progress stays for offline (customer marks paid manually)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS payout_reference VARCHAR(255);
