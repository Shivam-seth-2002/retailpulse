const { getDb } = require('../connection');

function findById(jobId) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM jobs WHERE job_id = ?').get(jobId);
  if (row) {
    if (row.payload) row.payload = JSON.parse(row.payload);
    if (row.result) row.result = JSON.parse(row.result);
  }
  return row;
}

function findAll(status) {
  const db = getDb();
  const stmt = status 
    ? db.prepare('SELECT * FROM jobs WHERE status = ? ORDER BY created_at DESC')
    : db.prepare('SELECT * FROM jobs ORDER BY created_at DESC');
    
  return stmt.all(status || undefined).map(row => {
    if (row.payload) row.payload = JSON.parse(row.payload);
    if (row.result) row.result = JSON.parse(row.result);
    return row;
  });
}

function findByStatus(statuses) {
  const db = getDb();
  const placeholders = statuses.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM jobs WHERE status IN (${placeholders})`).all(...statuses).map(row => {
    if (row.payload) row.payload = JSON.parse(row.payload);
    if (row.result) row.result = JSON.parse(row.result);
    return row;
  });
}

function create(job) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO jobs (job_id, type, status, priority, payload, attempts, current_step)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    job.id, 
    job.type, 
    job.status, 
    job.priority || 0, 
    job.payload ? JSON.stringify(job.payload) : null,
    job.attempts || 0,
    job.current_step || null
  );
  
  return findById(job.id);
}

function updateState(jobId, { status, current_step, result, error, attempts }) {
  const db = getDb();
  const fields = [];
  const params = [];
  
  if (status !== undefined) {
    fields.push('status = ?');
    params.push(status);
  }
  if (current_step !== undefined) {
    fields.push('current_step = ?');
    params.push(current_step);
  }
  if (result !== undefined) {
    fields.push('result = ?');
    params.push(result ? JSON.stringify(result) : null);
  }
  if (error !== undefined) {
    fields.push('error = ?');
    params.push(error);
  }
  if (attempts !== undefined) {
    fields.push('attempts = ?');
    params.push(attempts);
  }
  
  if (fields.length === 0) return findById(jobId);
  
  fields.push('updated_at = CURRENT_TIMESTAMP');
  params.push(jobId);
  
  const sql = `UPDATE jobs SET ${fields.join(', ')} WHERE job_id = ?`;
  db.prepare(sql).run(...params);
  
  return findById(jobId);
}

function remove(jobId) {
  const db = getDb();
  return db.prepare('DELETE FROM jobs WHERE job_id = ? AND status = ?').run(jobId, 'PENDING').changes > 0;
}

module.exports = {
  findById,
  findAll,
  findByStatus,
  create,
  updateState,
  remove
};
