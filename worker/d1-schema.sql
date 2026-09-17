-- ─────────────────────────────────────────────────────────────
-- ShorTul D1 Schema (click aggregation buffer)
-- Run: npx wrangler d1 execute shortul_db --file=./d1-schema.sql
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS click_buffer (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shortcode TEXT NOT NULL,
  clicked_at TEXT NOT NULL,
  country TEXT,
  device_type TEXT,
  referrer TEXT,
  visitor_hash TEXT,
  synced INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_buffer_shortcode ON click_buffer (shortcode);
CREATE INDEX IF NOT EXISTS idx_buffer_synced ON click_buffer (synced);
CREATE INDEX IF NOT EXISTS idx_buffer_date ON click_buffer (clicked_at);

CREATE INDEX IF NOT EXISTS idx_buffer_agg ON click_buffer (shortcode, synced);
