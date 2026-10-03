# RetailPulse – Backend Automation Platform: Implementation Plan

> **Instructions for the AI building this project:** Build the project exactly as described below. Use **only** this tech stack: **Node.js, Express.js, REST APIs, custom data structures, and SQL (SQLite with `better-sqlite3`)**. Do **NOT** use Docker, CI/CD, any cloud service (Azure/AWS/GCP), an ORM, TypeScript, Redis or any message broker. Write all data structures (LRU cache, queue, filter tree) by hand in plain JavaScript; don't import libraries for them. Write clean, commented, modular code a junior developer can explain in an interview.

---

## 1. Project Goal

RetailPulse is a backend platform for a retail business. It:
1. **Ingests large retail datasets** (products, stores, sales, inventory) from CSV files using streams and batched SQL inserts.
2. **Exposes secure REST APIs** that let internal systems exchange data (query sales, inventory, reports).
3. **Handles complex user intents.** A client sends a structured intent, for example *"find low-stock products in Delhi stores with sales > 500 last 30 days"*, and the backend turns it into safe, parameterized SQL.
4. **Orchestrates workflows.** Long-running jobs (CSV import, daily report generation, restock alerts) run through an in-memory job queue, and a state machine tracks each job's state.

---

## 2. Tech Stack (strict)

| Layer | Choice |
|---|---|
| Runtime | Node.js 20+ (CommonJS or ES Modules, pick one and use it everywhere) |
| Web framework | Express.js 4 |
| Database | SQLite via `better-sqlite3` (raw SQL, no ORM) |
| CSV parsing | `csv-parse` (stream mode) |
| Validation | `joi` |
| Security | `helmet`, `cors`, `express-rate-limit`, API-key middleware |
| Logging | `morgan` + a small custom logger |
| Config | `dotenv` |
| Testing | `jest` + `supertest` |
| Dev | `nodemon` |

---

## 3. Folder Structure

```
retailpulse/
├── package.json
├── .env.example
├── README.md
├── data/
│   ├── seed/                  # sample CSVs (generate via script)
│   └── retailpulse.db         # created at runtime (gitignored)
├── scripts/
│   ├── generateSampleData.js  # generates 100k+ sales rows for testing
│   └── initDb.js              # runs schema.sql
├── src/
│   ├── server.js              # starts the HTTP server
│   ├── app.js                 # express app, middleware, routes
│   ├── config/index.js
│   ├── db/
│   │   ├── schema.sql
│   │   ├── connection.js      # singleton better-sqlite3 instance (WAL mode)
│   │   └── repositories/      # productRepo.js, salesRepo.js, inventoryRepo.js, jobRepo.js
│   ├── dataStructures/
│   │   ├── LRUCache.js        # HashMap + Doubly Linked List
│   │   ├── JobQueue.js        # FIFO queue (linked list) + priority support
│   │   ├── FilterTree.js      # AST nodes for nested filters
│   │   └── StateMachine.js    # transition table (Map of Sets)
│   ├── engine/
│   │   ├── filterCompiler.js  # FilterTree -> parameterized SQL WHERE
│   │   ├── intentRegistry.js  # Map<intentName, handler>
│   │   └── intents/           # lowStock.js, topSellers.js, salesTrend.js, storeComparison.js
│   ├── workflows/
│   │   ├── orchestrator.js    # pulls jobs from queue, runs steps, updates state
│   │   ├── workers/           # csvImport.worker.js, dailyReport.worker.js, restockAlert.worker.js
│   │   └── definitions.js     # workflow = ordered list of steps
│   ├── ingestion/csvStreamer.js
│   ├── middleware/            # auth.js, validate.js, errorHandler.js, rateLimiter.js
│   ├── routes/                # products, sales, inventory, intents, jobs, health
│   ├── controllers/
│   └── utils/                 # logger.js, ApiError.js, pagination.js
└── tests/
    ├── unit/                  # LRUCache, JobQueue, FilterTree, StateMachine, filterCompiler
    └── integration/           # API tests with supertest
```

---

## 4. Database Schema (`src/db/schema.sql`)

```sql
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

CREATE INDEX IF NOT EXISTS idx_sales_store_date   ON sales(store_id, sold_at);
CREATE INDEX IF NOT EXISTS idx_sales_product_date ON sales(product_id, sold_at);
CREATE INDEX IF NOT EXISTS idx_jobs_status        ON jobs(status);
```

Connection setup: `db.pragma('journal_mode = WAL'); db.pragma('foreign_keys = ON');`

---

## 5. Core Data Structures (hand-written, with unit tests)

### 5.1 `LRUCache` (Hash Map + Doubly Linked List)
- Purpose: cache results of repeated intent/API queries.
- Methods: `get(key)`, `set(key, value, ttlMs)`, `delete(key)`, `clear()`, `stats()` (hits, misses, size).
- `get` and `set` must both run in **O(1)**. Use a `Map` for key → node and a doubly linked list for recency order.
- Optional TTL per entry; an expired entry counts as a miss.
- Cache key = `intentName + ':' + stableStringify(params)` (sort the object keys).
- Invalidate the related cache keys when data changes (after an import job finishes, clear the cache).

### 5.2 `JobQueue` (Linked-list FIFO + priority buckets)
- `enqueue(job, priority=0)`, `dequeue()`, `peek()`, `size()`, `isEmpty()`, `remove(jobId)`.
- Priority: keep a `Map<priority, LinkedListQueue>` and dequeue from the highest priority first. Every operation is O(1) except choosing the bucket (there are only a few fixed levels: 0, 1, 2).
- Do not use `Array.shift()`, because it's O(n). Explain this in a code comment.

### 5.3 `FilterTree` (Tree / AST)
- Clients send nested JSON filters:
```json
{
  "and": [
    { "field": "city", "op": "eq", "value": "Delhi" },
    { "or": [
        { "field": "category", "op": "in", "value": ["Grocery", "Dairy"] },
        { "field": "total_sales", "op": "gt", "value": 500 }
    ]}
  ]
}
```
- `FilterTree.parse(json)` builds `LogicalNode {op: AND|OR|NOT, children[]}` and `ConditionNode {field, op, value}`.
- Validate during parsing: max depth 5, max 30 nodes, ops whitelist `eq, ne, gt, gte, lt, lte, in, between, like`.

### 5.4 `StateMachine` (transition table)
```js
const TRANSITIONS = new Map([
  ['PENDING',   new Set(['RUNNING', 'CANCELLED'])],
  ['RUNNING',   new Set(['COMPLETED', 'FAILED', 'RETRYING'])],
  ['RETRYING',  new Set(['RUNNING', 'FAILED'])],
  ['FAILED',    new Set([])],
  ['COMPLETED', new Set([])],
  ['CANCELLED', new Set([])],
]);
```
- `transition(job, nextState)` throws `InvalidTransitionError` if the move is not allowed. Every transition is written to the `jobs` table.

---

## 6. Filter Compiler (`engine/filterCompiler.js`)
- Walk the `FilterTree` recursively (DFS) and produce `{ whereSql, params }`.
- **Field whitelist**: a `Map` from public field name → real SQL column, e.g. `city → s.city`, `category → p.category`, `total_sales → SUM(sa.amount)`. Any field that isn't in the map is rejected with 400.
- Fields that use aggregates (`total_sales`) go into a `HAVING` clause. Normal fields go into `WHERE`.
- **All values are bound as `?` parameters.** Never concatenate user values into SQL strings.
- Example output: `WHERE s.city = ? AND (p.category IN (?, ?))  HAVING SUM(sa.amount) > ?` with params `['Delhi','Grocery','Dairy',500]`.

---

## 7. Intent Engine (handles "complex user intents")

- `intentRegistry.js` exports a `Map<string, IntentHandler>`.
- Every intent module exports:
```js
module.exports = {
  name: 'low_stock',
  description: 'Products below reorder level, optionally filtered',
  schema: Joi.object({ filters: Joi.object(), limit: Joi.number().max(500).default(50) }),
  cacheTtlMs: 60_000,
  execute: (params, db) => { /* build SQL using filterCompiler, return rows */ }
};
```
- Intents to implement:
  1. `low_stock`: inventory where quantity < reorder_level, plus filters.
  2. `top_sellers`: top N products by revenue in a date range.
  3. `sales_trend`: daily/weekly/monthly totals (group with `strftime`).
  4. `store_comparison`: revenue, units and average basket per store.
  5. `restock_recommendation`: average daily sales over the last 30 days × lead days − current stock.
- Flow for `POST /api/v1/intents/execute`:
  `validate body → lookup handler in Map (404 if missing) → validate params with handler.schema → check LRU cache → execute → store in cache → return { intent, cached, durationMs, rowCount, data }`.
- `GET /api/v1/intents` lists the available intents and their descriptions.

---

## 8. Workflow Orchestration

- `workflows/definitions.js`: each workflow is an ordered array of named steps:
```js
CSV_IMPORT:   ['validateFile', 'streamParse', 'batchInsert', 'invalidateCache', 'summarize']
DAILY_REPORT: ['aggregateSales', 'computeKpis', 'persistReport']
RESTOCK_ALERT:['findLowStock', 'computeRecommendations', 'persistAlerts']
```
- `orchestrator.js`:
  - Holds the singleton `JobQueue`. Runs a loop with `setImmediate`/`setInterval`, and a concurrency limit (default 2, configurable).
  - For every job: `PENDING → RUNNING`, run the steps in order, update `current_step` in the DB after each step, and finish as `COMPLETED` with the result.
  - On error: if `attempts < MAX_RETRIES (3)`, move to `RETRYING`, then re-enqueue with exponential backoff (`setTimeout`). Otherwise move to `FAILED` with the error message.
  - On server start, **recover**: re-enqueue jobs left in `PENDING`/`RETRYING`, and mark old `RUNNING` jobs as `RETRYING`.
  - Emits events with Node's `EventEmitter` (`job:started`, `job:step`, `job:completed`, `job:failed`), which are used for logging.
- Optional scheduler: use `setInterval` to enqueue `DAILY_REPORT` every 24 hours. Don't use any cron library.

---

## 9. Large Dataset Ingestion (`ingestion/csvStreamer.js`)
- Use `fs.createReadStream` → `csv-parse` stream. **Never load the whole file into memory.**
- Buffer the rows into an array of 1,000 (`BATCH_SIZE`). Insert each batch inside one `db.transaction()` using a prepared statement.
- Validate each row (types, required fields). Count invalid rows and save up to 100 examples of them in the job result. Don't crash on bad rows.
- Handle backpressure: pause the stream while a batch is being written, then resume.
- Report progress (`rowsProcessed`) to the job record every 10 batches.
- `scripts/generateSampleData.js` must generate 50 stores, 2,000 products and **200,000+ sales rows** so performance can be demonstrated.

---

## 10. REST API (prefix `/api/v1`)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | DB connected, queue size, cache stats, uptime (no auth) |
| GET | `/products` | List with keyset pagination (`?limit=&cursor=`), `?category=` |
| GET | `/products/:id` | Single product |
| POST | `/products` | Create (Joi validated) |
| PATCH | `/products/:id` | Update price/category |
| GET | `/stores` | List stores |
| GET | `/inventory?storeId=` | Inventory by store |
| PUT | `/inventory/:storeId/:productId` | Upsert quantity (`INSERT ... ON CONFLICT DO UPDATE`) |
| GET | `/sales?from=&to=&storeId=&limit=&cursor=` | Paginated sales |
| POST | `/sales/bulk` | Bulk insert JSON (max 5,000 rows), transactional |
| GET | `/intents` | List intents |
| POST | `/intents/execute` | Execute an intent |
| POST | `/jobs` | Create job `{type, payload, priority}` → returns 202 + jobId |
| POST | `/jobs/import` | Upload a CSV path/type → enqueue CSV_IMPORT |
| GET | `/jobs/:id` | Job status, current step, result |
| GET | `/jobs?status=` | List jobs |
| DELETE | `/jobs/:id` | Cancel (only if PENDING) |
| GET | `/admin/cache` / DELETE `/admin/cache` | Cache stats / clear |

**Response format (consistent):**
```json
{ "success": true, "data": {}, "meta": { "durationMs": 12, "nextCursor": "..." } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
```

---

## 11. Security & Reliability
- **API-key auth**: header `x-api-key`. Keep valid keys in `.env` (comma-separated). Store them as a `Set` of SHA-256 hashes and compare with `crypto.timingSafeEqual`.
- Two roles: `read` keys can only use GET and intents; `admin` keys can also write and use jobs.
- `helmet()`, `cors({ origin: whitelist })`, `express.json({ limit: '1mb' })`, and `express-rate-limit` (100 req/min per key).
- All SQL uses prepared statements. Field and sort names come only from whitelists.
- Central `errorHandler` middleware with a custom `ApiError` class. Never leak stack traces in production.
- Audit middleware records every request in `audit_log`.
- Graceful shutdown on `SIGINT`/`SIGTERM`: stop accepting new jobs, wait for running jobs (with a timeout), then close the DB.

---

## 12. Testing
- **Unit tests (Jest):** LRUCache (eviction order, TTL, O(1) behaviour), JobQueue (priority order, remove), FilterTree (parse, depth limits, invalid ops), StateMachine (valid/invalid transitions), filterCompiler (correct SQL + params, rejects unknown fields, SQL-injection strings stay as params).
- **Integration tests (supertest)** with an in-memory SQLite DB (`:memory:`): auth failures (401/403), CRUD, pagination, intent execution with cache hit on the second call, job lifecycle (create → poll until COMPLETED).
- Target ≥ 80% coverage (`jest --coverage`).

---

## 13. npm Scripts
```json
"scripts": {
  "start": "node src/server.js",
  "dev": "nodemon src/server.js",
  "db:init": "node scripts/initDb.js",
  "seed": "node scripts/generateSampleData.js",
  "test": "jest --runInBand",
  "test:coverage": "jest --coverage --runInBand"
}
```

---

## 14. Build Order (follow step by step)
1. `npm init`, install the dependencies, set up `.env.example`, config and logger.
2. DB connection + `schema.sql` + `initDb.js`.
3. Data structures (`LRUCache`, `JobQueue`, `FilterTree`, `StateMachine`) **with unit tests first**.
4. Repositories (raw SQL with prepared statements).
5. Express app, middleware (auth, validation, error handling, rate limiting), health route.
6. CRUD routes for products, stores, inventory and sales with keyset pagination.
7. `filterCompiler` + intent registry + 5 intents + LRU caching.
8. CSV streamer + sample data generator.
9. Orchestrator, workers, job routes, crash recovery, graceful shutdown.
10. Integration tests, README (setup steps, API examples with `curl`, architecture diagram in Mermaid, explanation of each data structure and its time complexity).

---

## 15. Definition of Done
- `npm run db:init && npm run seed && npm run dev` works on a fresh Windows machine with only Node.js installed.
- Importing 200k rows succeeds without memory spikes, and the job status is visible through `/jobs/:id`.
- A repeated intent call returns `"cached": true` and is clearly faster.
- `npm test` passes with ≥ 80% coverage.
- README explains the architecture, data structures, and how to call each endpoint.
