-- RetailPulse database schema (SQLite).
-- Every statement uses IF NOT EXISTS, so running this file again is safe.

CREATE TABLE IF NOT EXISTS stores (
  store_id   INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  city       TEXT NOT NULL,
  region     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  product_id INTEGER PRIMARY KEY,
  sku        TEXT UNIQUE NOT NULL,
  name       TEXT NOT NULL,
  category   TEXT NOT NULL,
  unit_price REAL NOT NULL CHECK (unit_price >= 0)
);

CREATE TABLE IF NOT EXISTS inventory (
  store_id      INTEGER NOT NULL REFERENCES stores(store_id),
  product_id    INTEGER NOT NULL REFERENCES products(product_id),
  quantity      INTEGER NOT NULL DEFAULT 0,
  reorder_level INTEGER NOT NULL DEFAULT 10,
  updated_at    TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (store_id, product_id)
);

CREATE TABLE IF NOT EXISTS sales (
  sale_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  store_id   INTEGER NOT NULL REFERENCES stores(store_id),
  product_id INTEGER NOT NULL REFERENCES products(product_id),
  quantity   INTEGER NOT NULL,
  amount     REAL NOT NULL,
  sold_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  job_id      TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  status      TEXT NOT NULL,          -- PENDING | RUNNING | COMPLETED | FAILED | RETRYING | CANCELLED
  priority    INTEGER DEFAULT 0,
  payload     TEXT,                   -- JSON
  result      TEXT,                   -- JSON
  error       TEXT,
  attempts    INTEGER DEFAULT 0,
  current_step TEXT,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  api_key_id TEXT,
  method     TEXT,
  path       TEXT,
  intent     TEXT,
  status     INTEGER,
  duration_ms INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Output of the DAILY_REPORT workflow (its "persistReport" step). One row per day.
CREATE TABLE IF NOT EXISTS daily_reports (
  report_date TEXT PRIMARY KEY,        -- YYYY-MM-DD
  data        TEXT NOT NULL,           -- JSON with the KPIs
  job_id      TEXT,
  created_at  TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Output of the RESTOCK_ALERT workflow (its "persistAlerts" step).
CREATE TABLE IF NOT EXISTS restock_alerts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id          TEXT,
  store_id        INTEGER NOT NULL,
  product_id      INTEGER NOT NULL,
  quantity        INTEGER NOT NULL,
  reorder_level   INTEGER NOT NULL,
  recommended_qty INTEGER NOT NULL,
  created_at      TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sales_store_date   ON sales(store_id, sold_at);
CREATE INDEX IF NOT EXISTS idx_sales_product_date ON sales(product_id, sold_at);
CREATE INDEX IF NOT EXISTS idx_jobs_status        ON jobs(status);
