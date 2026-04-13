import { PrismaClient } from '@prisma/client';
import path from 'path';

// Local SQLite DB path
const dbPath = path.resolve('C:/Users/pisan/OneDrive/Escritorio/Proyecto Optica/Fotos Tere/Facturas atelier clientes/CRM_Antigravity/prisma/dev.db');
const DATABASE_URL = `file:${dbPath}`;

// We need to temporarily tell Prisma to use SQLite because the schema says PostgreSQL
// This is tricky with Prisma because the provider is fixed in the schema.
// However, if we just want to query the SQLite file, we could use better-sqlite3 directly.

import Database from 'better-sqlite3';

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
