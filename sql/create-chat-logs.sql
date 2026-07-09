-- Run this SQL once in your Vercel Postgres or Neon SQL editor.
-- It creates a table for saving every shopper request and concierge response.

CREATE TABLE IF NOT EXISTS chat_logs (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_message TEXT NOT NULL,
  advisor_message TEXT NOT NULL,
  recommended_product_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_product_names JSONB NOT NULL DEFAULT '[]'::jsonb,
  user_ip TEXT,
  user_agent TEXT
);

-- This index makes it faster to view the newest chats first.
CREATE INDEX IF NOT EXISTS chat_logs_created_at_idx
ON chat_logs (created_at DESC);
