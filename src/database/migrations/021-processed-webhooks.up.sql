-- ============================================================
-- 021 — Webhook idempotency table
-- ============================================================
-- Stores every Squad transaction_ref we have already processed.
-- The webhook handler inserts here before doing any work, so
-- retries or replays are acknowledged (200) without reprocessing.
--
-- Backfill: seeds all transaction refs already in payment_logs so
-- existing transactions are protected from double-processing
-- if Squad ever replays an old webhook.
-- ============================================================

CREATE TABLE IF NOT EXISTS processed_webhooks (
    transaction_ref VARCHAR(255) PRIMARY KEY,
    processed_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Backfill existing payment refs
INSERT INTO processed_webhooks (transaction_ref, processed_at)
SELECT squad_transaction_id, created_at
FROM   payment_logs
WHERE  squad_transaction_id IS NOT NULL
ON CONFLICT DO NOTHING;
