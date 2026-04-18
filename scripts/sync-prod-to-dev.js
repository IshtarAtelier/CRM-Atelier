/**
 * sync-prod-to-dev.js
 * 
 * Copies all data from Production PostgreSQL to Development PostgreSQL.
 * 
 * Usage: node scripts/sync-prod-to-dev.js
 */

const { PrismaClient } = require('@prisma/client');

// Fallbacks are ONLY kept for backward compatibility if env vars aren't set in older environments, 
// but env vars are heavily preferred now.
const PROD_URL = process.env.PROD_DATABASE_URL || "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";
const DEV_URL = process.env.DEV_DATABASE_URL || process.env.DATABASE_URL || "postgresql://postgres:RrPSyEGtnMDeqWUAqHKGEIEHUmPcBSAL@interchange.proxy.rlwy.net:12759/railway";

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
    'FixedCost',
    'WhatsAppChat',
    'WhatsAppMessage',
    '_ClientToTag',
    '_OrderToTag',
];

async function main() {
    console.log('🔄 Sincronizando Producción → Desarrollo (Cloud to Cloud)...\n');

    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    const dev = new PrismaClient({ datasources: { db: { url: DEV_URL } } });

    try {
        await prod.$connect();
        console.log('✅ Conectado a Producción');
        await dev.$connect();
        console.log('✅ Conectado a Desarrollo');

        // Clean dev database first (in reverse dependency order)
        console.log('\n🗑️  Limpiando base de datos de Desarrollo...');
        for (const table of [...TABLES].reverse()) {
            try {
                await dev.$executeRawUnsafe(`TRUNCATE TABLE "${table}" CASCADE`);
            } catch (e) {
                // Ignore errors for tables that might not exist or non-cascadable
            }
        }

        let totalRows = 0;
        for (const table of TABLES) {
            console.log(`\n📦 Procesando tabla: ${table}`);
            
            // Fetch from production
            const rows = await prod.$queryRawUnsafe(`SELECT * FROM "${table}"`);
            
            if (!rows || rows.length === 0) {
                console.log(`   ⬜ 0 registros`);
                continue;
            }

            // Insert into development
            const columns = Object.keys(rows[0]);
            const columnList = columns.map(c => `"${c}"`).join(', ');
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

            for (const row of rows) {
                const values = Object.values(row);
                await dev.$executeRawUnsafe(
                    `INSERT INTO "${table}" (${columnList}) VALUES (${placeholders})`,
                    ...values
                );
            }

            totalRows += rows.length;
            console.log(`   ✅ ${rows.length} registros copiados`);
        }

        console.log(`\n✨ Sincronización exitosa: ${totalRows} registros totales.`);

    } catch (error) {
        console.error('\n❌ Error durante la sincronización:', error);
    } finally {
        await prod.$disconnect();
        await dev.$disconnect();
    }
}

main();
