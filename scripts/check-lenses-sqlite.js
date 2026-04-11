const Database = require('better-sqlite3');
const db = new Database('dev.db');

try {
  const totalLenses = db.prepare("SELECT COUNT(*) as count FROM Product WHERE category = 'LENS'").get();
  const lensesWithoutIndex = db.prepare("SELECT * FROM Product WHERE category = 'LENS' AND (lensIndex IS NULL OR lensIndex = '')").all();

  console.log(`Total lenses: ${totalLenses.count}`);
  console.log(`Lenses without index: ${lensesWithoutIndex.length}`);
  
  if (lensesWithoutIndex.length > 0) {
    console.log('Details:');
    lensesWithoutIndex.forEach(l => {
      console.log(`- [${l.id}] ${l.name || 'No Name'} (${l.brand || 'No Brand'} ${l.model || ''}) - Type: ${l.type}`);
    });
  } else {
    console.log('All lenses have a refractive index loaded.');
  }
} catch (error) {
  console.error('Error querying database:', error);
} finally {
  db.close();
}
