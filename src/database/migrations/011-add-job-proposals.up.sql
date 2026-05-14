CREATE TABLE IF NOT EXISTS job_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_request_id UUID NOT NULL REFERENCES job_requests(id) ON DELETE CASCADE,
  worker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  proposed_amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(job_request_id, worker_id)
);
