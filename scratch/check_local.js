const Database = require('better-sqlite3');
const path = require('path');

// Local SQLite DB path
const dbPath = path.resolve('C:/Users/pisan/OneDrive/Escritorio/Proyecto Optica/Fotos Tere/Facturas atelier clientes/CRM_Antigravity/dev.db');

function searchLocalDB() {
  console.log('Searching local SQLite DB at:', dbPath);
  try {
    const db = new Database(dbPath);
    const row = db.prepare("SELECT * FROM CashMovement WHERE amount = 250000 AND reason LIKE '%Inti Balderrama Artifoni%'").get();
    
    if (row) {
      console.log('Found in local DB:', JSON.stringify(row, null, 2));
    } else {
      console.log('Not found in local DB.');
    }
    db.close();
  } catch (err) {
    console.error('Error reading local DB:', err.message);
  }
}

searchLocalDB();
