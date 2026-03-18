const { PrismaClient } = require('../prisma/generated/client');
const p = new PrismaClient();
async function main() {
    try {
        const r = await p.product.findFirst({ where: { brand: 'Varilux' } });
        console.log('OK findFirst:', r ? r.name : 'null');
    } catch (e) {
        console.error('FULL ERROR:', e.message);
    }
    await p.$disconnect();
}
main();
