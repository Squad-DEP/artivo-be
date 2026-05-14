-- Drop old status constraint and add pending_payment + cancelled statuses
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('pending', 'pending_payment', 'in_progress', 'worker_completed', 'customer_completed', 'completed', 'disputed', 'cancelled', 'paid'));
