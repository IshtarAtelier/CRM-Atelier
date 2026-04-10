/**
 * sync-prod-to-local.js
 * 
 * Copies all data from production PostgreSQL to local SQLite.
 * Run this anytime you want to refresh your local test database.
 * 
 * Usage: node scripts/sync-prod-to-local.js
 */

const { PrismaClient: PgClient } = require('@prisma/client');
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const PROD_URL = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";
const LOCAL_DB = path.join(__dirname, '..', 'prisma', 'dev.db');

// Tables in dependency order (parents before children)
const TABLES = [
    'User',
    'Client',
    'Tag',
    'Doctor',
    'Interaction',
    'ClientTask',
    'Prescription',
    'Product',
    'Order',
    'OrderItem',
    'Payment',
    'Invoice',
    'CashMovement',
    'DoctorPayment',
    'Notification',
    'MonthlyTarget',
    'WhatsAppChat',
    'WhatsAppMessage',
    // Junction tables
    '_ClientToTag',
    '_OrderToTag',
];

async function main() {
    console.log('🔄 Sincronizando producción → local...\n');

    // 1. Connect to production
    const pg = new PgClient({ datasources: { db: { url: PROD_URL } } });
    await pg.$connect();
    console.log('✅ Conectado a producción (PostgreSQL)');

    // 2. Prepare local SQLite
    if (fs.existsSync(LOCAL_DB)) {
        fs.unlinkSync(LOCAL_DB);
        console.log('🗑️  Base local anterior eliminada');
    }

    // 3. Generate fresh SQLite schema via Prisma
    const { execSync } = require('child_process');
    
    // Temporarily switch schema to SQLite
    const schemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');
    const originalSchema = fs.readFileSync(schemaPath, 'utf8');
    const sqliteSchema = originalSchema
        .replace(/provider\s*=\s*"postgresql"/, 'provider = "sqlite"')
        .replace(/url\s*=\s*env\("DATABASE_URL"\)/, 'url = "file:./dev.db"');
    
    fs.writeFileSync(schemaPath, sqliteSchema);
    
    try {
        console.log('📐 Creando esquema SQLite...');
        execSync('npx prisma db push --skip-generate --accept-data-loss', { 
            cwd: path.join(__dirname, '..'),
            stdio: 'pipe' 
        });
        console.log('✅ Esquema SQLite creado');
    } finally {
        // Always restore original schema
        fs.writeFileSync(schemaPath, originalSchema);
    }

    // 4. Open SQLite and copy data
    const sqlite = new Database(LOCAL_DB);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = OFF'); // Disable FK checks during import

    let totalRows = 0;

    for (const table of TABLES) {
        try {
            // Fetch from production
            const rows = await pg.$queryRawUnsafe(`SELECT * FROM "${table}"`);
            
            if (!rows || rows.length === 0) {
                console.log(`   ⬜ ${table}: 0 registros`);
                continue;
            }

            // Get column names from first row
            const columns = Object.keys(rows[0]);
            const placeholders = columns.map(() => '?').join(', ');
            const columnList = columns.map(c => `"${c}"`).join(', ');

            const insert = sqlite.prepare(
                `INSERT OR IGNORE INTO "${table}" (${columnList}) VALUES (${placeholders})`
            );

            const insertMany = sqlite.transaction((items) => {
                for (const item of items) {
                    const values = columns.map(col => {
                        const val = item[col];
                        if (val === null || val === undefined) return null;
                        if (val instanceof Date) return val.toISOString();
                        if (typeof val === 'boolean') return val ? 1 : 0;
                        if (typeof val === 'object') return JSON.stringify(val);
                        return val;
                    });
                    insert.run(...values);
                }
            });

            insertMany(rows);
            totalRows += rows.length;
            console.log(`   ✅ ${table}: ${rows.length} registros copiados`);
        } catch (err) {
            console.log(`   ⚠️  ${table}: ${err.message.slice(0, 80)}`);
        }
    }

    sqlite.pragma('foreign_keys = ON');
    sqlite.close();
    await pg.$disconnect();

    console.log(`\n✨ Sincronización completada: ${totalRows} registros totales`);
    console.log(`📁 Base local: ${LOCAL_DB}`);
    console.log(`\n💡 Para usar la base local, asegurate de que tu .env tenga:`);
    console.log(`   DATABASE_URL="file:./prisma/dev.db"`);
    console.log(`   Y que schema.prisma tenga provider = "sqlite"`);
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
