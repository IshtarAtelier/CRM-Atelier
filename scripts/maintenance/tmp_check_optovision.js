const { PrismaClient } = require('./prisma/generated/client');
const p = new PrismaClient();

async function main() {
    const results = await p.$queryRaw`
        SELECT id, brand, name, type, category, "lensIndex", stock, cost, price, laboratory, "unitType"
        FROM "Product" 
        WHERE laboratory = 'OPTOVISION' 
        LIMIT 5
    `;
    console.log('OPTOVISION products (first 5):');
    results.forEach(o => console.log(JSON.stringify(o)));

    const combos = await p.$queryRaw`
        SELECT category, type, COUNT(*) as cnt 
        FROM "Product" 
        GROUP BY category, type 
        ORDER BY cnt DESC
    `;
    console.log('\nAll type/category combos:');
    combos.forEach(t => console.log('  ' + t.category + ' / ' + t.type + ': ' + t.cnt));

    const sygnus = await p.$queryRaw`
        SELECT id, brand, name, type, category, stock, cost, price, laboratory 
        FROM "Product" 
        WHERE brand = 'Sygnus' 
        LIMIT 5
    `;
    console.log('\nSygnus products (first 5):');
    sygnus.forEach(o => console.log(JSON.stringify(o)));
}

main().finally(() => p.$disconnect());
