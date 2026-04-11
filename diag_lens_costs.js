const Database = require('better-sqlite3');
const path = require('path');

// Reaching the dev.db file
const dbPath = path.join(__dirname, 'prisma', 'dev.db');
const db = new Database(dbPath);

async function main() {
    // Current period (April 2026)
    const now = new Date('2026-04-11');
    const from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();

    console.log(`Analyzing costs from ${new Date(from).toLocaleDateString()} to ${new Date(to).toLocaleDateString()}`);

    // Query non-deleted SALE orders and their items
    const query = `
        SELECT 
            p.brand, p.model, p.name as pName, p.type, p.category, p.cost,
            oi.quantity, oi.price as sellPrice,
            o.createdAt, o.id as orderId
        FROM "Order" o
        JOIN "OrderItem" oi ON o.id = oi.orderId
        JOIN "Product" p ON oi.productId = p.id
        WHERE o.orderType = 'SALE' 
          AND o.isDeleted = 0
          AND o.createdAt >= ? 
          AND o.createdAt <= ?
    `;

    const items = db.prepare(query).all(from, to);

    let totalCostLenses = 0;
    const itemsByProduct = {};

    for (const item of items) {
        const cat = (item.category || '').toUpperCase();
        const type = (item.type || '').toLowerCase();
        
        const isLens = cat.includes('LENS') || 
                       type.includes('cristal') || 
                       type.includes('multifocal') || 
                       type.includes('monofocal');

        if (isLens) {
            const itemCost = (item.cost || 0) * item.quantity;
            totalCostLenses += itemCost;

            const pName = `${item.brand || ''} ${item.model || item.pName || 'Sin nombre'}`.trim();
            const key = `${pName} (${item.type || 'LENTE'})`;
            
            if (!itemsByProduct[key]) itemsByProduct[key] = { cost: 0, qty: 0 };
            itemsByProduct[key].cost += itemCost;
            itemsByProduct[key].qty += item.quantity;
        }
    }

    console.log(`TOTAL_LENS_COST: $${totalCostLenses.toLocaleString()}`);
    console.log('\n--- TOP 20 PRODUCTOS QUE SUMAN AL COSTO ---');
    const sorted = Object.entries(itemsByProduct).sort((a, b) => b[1].cost - a[1].cost);
    sorted.slice(0, 20).forEach(([name, data]) => {
        console.log(`${name}: $${data.cost.toLocaleString()} (${data.qty} unidades)`);
    });

    if (totalCostLenses === 0) {
        console.log('\nADVERTENCIA: No se encontraron costos de lentes en el rango de fechas actual.');
        console.log('Verificando todas las ventas sin filtro de fecha...');
        const totalAll = db.prepare(`
            SELECT SUM(p.cost * oi.quantity) as total 
            FROM "Order" o 
            JOIN "OrderItem" oi ON o.id = oi.orderId 
            JOIN "Product" p ON oi.productId = p.id 
            WHERE o.orderType = 'SALE' AND o.isDeleted = 0
            AND (p.category LIKE '%LENS%' OR p.type LIKE '%Cristal%' OR p.type LIKE '%Multifocal%')
        `).get();
        console.log(`Costo Histórico Total: $${(totalAll.total || 0).toLocaleString()}`);
    }
}

main().catch(console.error).finally(() => db.close());
