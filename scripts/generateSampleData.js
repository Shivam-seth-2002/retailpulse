const fs = require('fs');
const path = require('path');
const config = require('../src/config');

const SEED_DIR = path.join(__dirname, '..', 'data', 'seed');

if (!fs.existsSync(SEED_DIR)) {
  fs.mkdirSync(SEED_DIR, { recursive: true });
}

function writeCsv(filename, headers, rowGenerator, count) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(SEED_DIR, filename);
    const stream = fs.createWriteStream(filePath);
    
    stream.write(headers.join(',') + '\n');
    
    let i = 0;
    
    function write() {
      let ok = true;
      do {
        if (i >= count) {
          stream.end();
          return resolve();
        }
        
        const row = rowGenerator(i);
        const line = row.join(',') + '\n';
        i++;
        
        if (i === count) {
          stream.write(line);
          stream.end();
          return resolve();
        } else {
          ok = stream.write(line);
        }
      } while (ok);
      
      if (i < count) {
        stream.once('drain', write);
      }
    }
    
    write();
  });
}

async function run() {
  console.log('Generating sample data...');
  const storeCount = 50;
  const productCount = 2000;
  const salesCount = config.seed.salesRows;

  // Stores
  const regions = ['North', 'South', 'East', 'West'];
  const cities = ['Delhi', 'Mumbai', 'Bangalore', 'Chennai', 'Kolkata', 'Pune', 'Hyderabad'];
  
  await writeCsv('stores.csv', ['store_id', 'name', 'city', 'region'], (i) => {
    const id = i + 1;
    return [
      id,
      `Store ${id}`,
      cities[i % cities.length],
      regions[i % regions.length]
    ];
  }, storeCount);
  console.log(`Generated ${storeCount} stores`);

  // Products
  const categories = ['Grocery', 'Dairy', 'Electronics', 'Clothing', 'Home'];
  
  await writeCsv('products.csv', ['product_id', 'sku', 'name', 'category', 'unit_price'], (i) => {
    const id = i + 1;
    return [
      id,
      `SKU-${10000 + id}`,
      `Product ${id}`,
      categories[i % categories.length],
      (Math.random() * 100 + 5).toFixed(2)
    ];
  }, productCount);
  console.log(`Generated ${productCount} products`);

  // Inventory
  await writeCsv('inventory.csv', ['store_id', 'product_id', 'quantity', 'reorder_level'], (i) => {
    const storeId = (i % storeCount) + 1;
    const productId = Math.floor(i / storeCount) + 1;
    return [
      storeId,
      productId,
      Math.floor(Math.random() * 100),
      Math.floor(Math.random() * 20) + 5
    ];
  }, storeCount * productCount);
  console.log(`Generated ${storeCount * productCount} inventory records`);

  // Sales (spread over last 30 days)
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  
  await writeCsv('sales.csv', ['store_id', 'product_id', 'quantity', 'amount', 'sold_at'], (i) => {
    const storeId = (i % storeCount) + 1;
    const productId = (i % productCount) + 1;
    const qty = Math.floor(Math.random() * 5) + 1;
    const amount = (qty * (Math.random() * 100 + 5)).toFixed(2);
    const date = new Date(now - Math.random() * 30 * dayMs).toISOString();
    return [
      storeId,
      productId,
      qty,
      amount,
      date
    ];
  }, salesCount);
  console.log(`Generated ${salesCount} sales records`);
  
  console.log('Sample data generation complete.');
}

run().catch(console.error);
