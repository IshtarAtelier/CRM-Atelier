const Database = require('better-sqlite3');
const path = require('path');

async function main() {
  const dbPath = '/Users/ishtarpissano/proyectos/atelier/prisma/dev.db';
  console.log(`Opening SQLite database at ${dbPath}`);
  const db = new Database(dbPath, { readonly: true });
  
  try {
    // List all tables
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    console.log("Tables:", tables.map(t => t.name));
    
    // Check ServicePricing count if it exists
    if (tables.some(t => t.name === 'ServicePricing')) {
      const count = db.prepare("SELECT count(*) as count FROM ServicePricing").get().count;
      console.log(`ServicePricing count in dev.db: ${count}`);
      if (count > 0) {
        const samples = db.prepare("SELECT * FROM ServicePricing LIMIT 5").all();
        console.log("ServicePricing sample:", samples);
      }
    }

    // Check Product count
    if (tables.some(t => t.name === 'Product')) {
      const count = db.prepare("SELECT count(*) as count FROM Product").get().count;
      console.log(`Product count in dev.db: ${count}`);
      if (count > 0) {
        const samples = db.prepare("SELECT * FROM Product LIMIT 5").all();
        console.log("Product sample:", samples);
      }
    }
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    db.close();
  }
}

main().catch(console.error);
