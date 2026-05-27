require("dotenv").config();
/**
 * sync-prod-to-local-pg.js
 * 
 * Copies all data from production PostgreSQL to local PostgreSQL.
 * Run this anytime you want to refresh your local test database.
 * 
 * Usage: node scripts/sync-prod-to-local-pg.js
 */

const { PrismaClient } = require('@prisma/client');

const PROD_URL = process.env.PROD_DATABASE_URL;
const LOCAL_URL = "postgresql://postgres:localpassword@localhost:5432/atelier?schema=public";

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
    'ServicePricing',
    'WebProduct',
    'FixedCost',
    // Junction tables
    '_ClientToTag',
    '_OrderToTag',
];

async function main() {
    console.log('🔄 Sincronizando producción → local (PostgreSQL)...\\n');

    // 1. Connect to both databases
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    const local = new PrismaClient({ datasources: { db: { url: LOCAL_URL } } });

    await prod.$connect();
    await local.$connect();
    console.log('✅ Conectado a ambas bases de datos');

    let totalRows = 0;

    for (const table of TABLES) {
        try {
            // Check if table exists in production
            let rows = [];
            try {
                rows = await prod.$queryRawUnsafe(`SELECT * FROM "${table}"`);
            } catch (e) {
                console.log(`   ⚠️  ${table} no existe en producción o error al leer.`);
                continue;
            }
            
            if (!rows || rows.length === 0) {
                console.log(`   ⬜ ${table}: 0 registros`);
                continue;
            }

            // Get column names from first row
            const columns = Object.keys(rows[0]);
            
            // Delete existing data in local table
            await local.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
            
            // We'll insert in batches of 100 to avoid query size limits
            const BATCH_SIZE = 100;
            for (let i = 0; i < rows.length; i += BATCH_SIZE) {
                const batch = rows.slice(i, i + BATCH_SIZE);
                
                const placeholders = batch.map((_, rIdx) => 
                    '(' + columns.map((_, cIdx) => `$${rIdx * columns.length + cIdx + 1}`).join(', ') + ')'
                ).join(', ');
                
                const columnList = columns.map(c => `"${c}"`).join(', ');
                const values = [];
                for (const item of batch) {
                    for (const col of columns) {
                        values.push(item[col]);
                    }
                }

                await local.$executeRawUnsafe(`INSERT INTO "${table}" (${columnList}) VALUES ${placeholders}`, ...values);
            }

            totalRows += rows.length;
            console.log(`   ✅ ${table}: ${rows.length} registros copiados`);
        } catch (err) {
            console.log(`   ⚠️  ${table}: Error al copiar - ${err.message}`);
        }
    }

    await local.$disconnect();
    await prod.$disconnect();

    console.log(`\\n✨ Sincronización completada: ${totalRows} registros totales`);
    console.log(`💡 Tu entorno local ahora es una copia exacta de producción.`);
}

main().catch(err => {
    console.error('❌ Error general:', err.message);
    process.exit(1);
});
