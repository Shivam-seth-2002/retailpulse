const fs = require('fs');
const { parse } = require('csv-parse');
const { getDb } = require('../db/connection');
const config = require('../config');
const Joi = require('joi');

const schemas = {
  stores: Joi.object({
    store_id: Joi.number().required(),
    name: Joi.string().required(),
    city: Joi.string().required(),
    region: Joi.string().required()
  }),
  products: Joi.object({
    product_id: Joi.number().required(),
    sku: Joi.string().required(),
    name: Joi.string().required(),
    category: Joi.string().required(),
    unit_price: Joi.number().min(0).required()
  }),
  inventory: Joi.object({
    store_id: Joi.number().required(),
    product_id: Joi.number().required(),
    quantity: Joi.number().min(0).required(),
    reorder_level: Joi.number().min(0).default(10)
  }),
  sales: Joi.object({
    store_id: Joi.number().required(),
    product_id: Joi.number().required(),
    quantity: Joi.number().min(1).required(),
    amount: Joi.number().min(0).required(),
    sold_at: Joi.string().isoDate().required()
  })
};

const insertStatements = {
  stores: 'INSERT OR IGNORE INTO stores (store_id, name, city, region) VALUES (?, ?, ?, ?)',
  products: 'INSERT OR IGNORE INTO products (product_id, sku, name, category, unit_price) VALUES (?, ?, ?, ?, ?)',
  inventory: `
    INSERT INTO inventory (store_id, product_id, quantity, reorder_level, updated_at) 
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(store_id, product_id) DO UPDATE SET 
      quantity = excluded.quantity, 
      reorder_level = excluded.reorder_level, 
      updated_at = CURRENT_TIMESTAMP
  `,
  sales: 'INSERT INTO sales (store_id, product_id, quantity, amount, sold_at) VALUES (?, ?, ?, ?, ?)'
};

function getRowValues(type, row) {
  if (type === 'stores') return [row.store_id, row.name, row.city, row.region];
  if (type === 'products') return [row.product_id, row.sku, row.name, row.category, row.unit_price];
  if (type === 'inventory') return [row.store_id, row.product_id, row.quantity, row.reorder_level];
  if (type === 'sales') return [row.store_id, row.product_id, row.quantity, row.amount, row.sold_at];
  return [];
}

async function processCsv(filePath, type, onProgress) {
  return new Promise((resolve, reject) => {
    if (!schemas[type]) {
      return reject(new Error(`Unknown CSV type: ${type}`));
    }

    const schema = schemas[type];
    const db = getDb();
    const stmt = db.prepare(insertStatements[type]);
    
    const insertBatch = db.transaction((rows) => {
      for (const row of rows) {
        stmt.run(...getRowValues(type, row));
      }
    });

    let batch = [];
    let rowsProcessed = 0;
    let invalidRowsCount = 0;
    let invalidExamples = [];
    let batchCount = 0;

    const parser = parse({
      columns: true,
      skip_empty_lines: true,
      cast: true
    });

    const stream = fs.createReadStream(filePath);

    parser.on('readable', function () {
      let record;
      while ((record = parser.read()) !== null) {
        const { error, value } = schema.validate(record, { stripUnknown: true });
        
        if (error) {
          invalidRowsCount++;
          if (invalidExamples.length < 100) {
            invalidExamples.push({ row: record, error: error.message });
          }
          continue;
        }

        batch.push(value);
        rowsProcessed++;

        if (batch.length >= config.ingestion.batchSize) {
          // Pause stream to handle backpressure
          stream.pause();
          
          try {
            insertBatch(batch);
            batch = [];
            batchCount++;
            
            if (batchCount % 10 === 0 && onProgress) {
              onProgress(rowsProcessed);
            }
          } catch (err) {
            stream.destroy();
            return reject(err);
          }
          
          stream.resume();
        }
      }
    });

    parser.on('error', (err) => {
      reject(err);
    });

    parser.on('end', () => {
      try {
        if (batch.length > 0) {
          insertBatch(batch);
          if (onProgress) onProgress(rowsProcessed);
        }
        resolve({
          rowsProcessed,
          invalidRowsCount,
          invalidExamples
        });
      } catch (err) {
        reject(err);
      }
    });

    stream.pipe(parser);
  });
}

module.exports = { processCsv };
