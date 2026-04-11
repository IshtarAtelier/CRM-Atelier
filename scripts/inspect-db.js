const Database = require('better-sqlite3');
const db = new Database('dev.db');

try {
  const columns = db.prepare("PRAGMA table_info(Product)").all();
  console.log('Columns in Product table:');
  columns.forEach(col => console.log(`- ${col.name} (${col.type})`));
} catch (error) {
  console.error('Error querying columns:', error);
} finally {
  db.close();
}
