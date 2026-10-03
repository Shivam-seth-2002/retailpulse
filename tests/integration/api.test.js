const request = require('supertest');
const app = require('../../src/app');
const { getDb, initSchema, closeDb } = require('../../src/db/connection');
const orchestrator = require('../../src/workflows/orchestrator');

let server;

beforeAll(async () => {
  initSchema();
  // We don't start the orchestrator fully (scheduler) to avoid timers,
  // but we can test the endpoints.
});

afterAll(async () => {
  await orchestrator.shutdown();
  closeDb();
});

describe('API Integration Tests', () => {
  const adminKey = 'test-admin-key';
  const readKey = 'test-read-key';
  
  test('GET /health works without auth', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ok');
  });

  test('Auth failures (401/403)', async () => {
    const r1 = await request(app).get('/api/v1/products');
    expect(r1.status).toBe(401);
    
    // Read key cannot POST to jobs
    const r2 = await request(app)
      .post('/api/v1/jobs')
      .set('x-api-key', readKey)
      .send({ type: 'CSV_IMPORT' });
    expect(r2.status).toBe(403);
  });

  test('CRUD products', async () => {
    // Create
    const createRes = await request(app)
      .post('/api/v1/products')
      .set('x-api-key', adminKey)
      .send({ sku: 'TEST-1', name: 'Test Product', category: 'Testing', unit_price: 10.5 });
    
    expect(createRes.status).toBe(201);
    const productId = createRes.body.data.product_id;
    
    // Get
    const getRes = await request(app)
      .get(`/api/v1/products/${productId}`)
      .set('x-api-key', readKey);
    expect(getRes.body.data.name).toBe('Test Product');
    
    // Update
    const updateRes = await request(app)
      .patch(`/api/v1/products/${productId}`)
      .set('x-api-key', adminKey)
      .send({ unit_price: 15.0 });
    expect(updateRes.body.data.unit_price).toBe(15.0);
  });

  test('Pagination', async () => {
    // Insert more products
    const db = getDb();
    const stmt = db.prepare('INSERT INTO products (sku, name, category, unit_price) VALUES (?, ?, ?, ?)');
    for (let i = 0; i < 5; i++) {
      stmt.run(`P-${i}`, `P${i}`, 'Cat', 10);
    }
    
    const res = await request(app)
      .get('/api/v1/products?limit=2')
      .set('x-api-key', readKey);
      
    expect(res.body.data.length).toBe(2);
    expect(res.body.meta.nextCursor).toBeDefined();
  });

  test('Intent execution with cache hit', async () => {
    const db = getDb();
    // seed some inventory
    db.prepare('INSERT OR IGNORE INTO stores (store_id, name, city, region) VALUES (1, \'S\', \'C\', \'R\')').run();
    db.prepare('INSERT OR IGNORE INTO products (product_id, sku, name, category, unit_price) VALUES (1, \'SKU1\', \'N\', \'C\', 1)').run();
    db.prepare('INSERT INTO inventory (store_id, product_id, quantity, reorder_level) VALUES (1, 1, 5, 10)').run();
    
    const payload = {
      intent: 'low_stock',
      params: { limit: 10 }
    };
    
    // First call
    const res1 = await request(app)
      .post('/api/v1/intents/execute')
      .set('x-api-key', readKey)
      .send(payload);
      
    expect(res1.status).toBe(200);
    expect(res1.body.meta.cached).toBe(false);
    expect(res1.body.data.length).toBeGreaterThan(0);
    
    // Second call
    const res2 = await request(app)
      .post('/api/v1/intents/execute')
      .set('x-api-key', readKey)
      .send(payload);
      
    expect(res2.status).toBe(200);
    expect(res2.body.meta.cached).toBe(true);
  });

  test('Job lifecycle', async () => {
    // Start orchestrator loop just for this test
    orchestrator.loop();
    
    const createRes = await request(app)
      .post('/api/v1/jobs')
      .set('x-api-key', adminKey)
      .send({
        type: 'DAILY_REPORT',
        payload: { date: '2024-01-01' }
      });
      
    expect(createRes.status).toBe(202);
    const jobId = createRes.body.data.id;
    
    // Poll until completed
    let job;
    for (let i = 0; i < 20; i++) {
      const getRes = await request(app)
        .get(`/api/v1/jobs/${jobId}`)
        .set('x-api-key', adminKey);
        
      job = getRes.body.data;
      if (job.status === 'COMPLETED' || job.status === 'FAILED') {
        break;
      }
      
      await new Promise(r => setTimeout(r, 100));
    }
    
    expect(job.status).toBe('COMPLETED');
    expect(job.current_step).toBe('done');
    
    // Stop orchestrator loop
    orchestrator.isShuttingDown = true;
  });
});
