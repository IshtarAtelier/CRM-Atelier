const { PrismaClient } = require('./prisma/generated/client');
const p = new PrismaClient();

async function main() {
    // Clients
    const clients = await p.client.findMany({ select: { id: true, name: true } });
    console.log('=== CLIENTS ===');
    clients.forEach(c => console.log(c.id + ' | ' + c.name));

    // Products
    const products = await p.product.findMany({ select: { id: true, name: true, brand: true, model: true, category: true, type: true, price: true, lensIndex: true, unitType: true } });
    console.log('\n=== PRODUCTS ===');
    products.forEach(pr => console.log(pr.id + ' | ' + pr.category + ' | ' + (pr.brand || '') + ' | ' + (pr.model || '') + ' | ' + (pr.name || '') + ' | ' + (pr.type || '') + ' | idx:' + (pr.lensIndex || '') + ' | unit:' + (pr.unitType || '') + ' | $' + pr.price));

    // Existing sales
    const orders = await p.order.findMany({
        where: { orderType: 'SALE', isDeleted: false },
        select: {
            id: true, total: true, paid: true, status: true, createdAt: true,
            client: { select: { name: true } },
            items: { select: { product: { select: { brand: true, model: true, name: true } }, quantity: true, price: true } },
            payments: { select: { amount: true, method: true } }
        }
    });
    console.log('\n=== EXISTING SALES ===');
    orders.forEach(o => {
        console.log(o.id.slice(-6) + ' | ' + (o.client?.name || '?') + ' | $' + o.total + ' | paid:$' + o.paid + ' | ' + o.status + ' | ' + o.createdAt.toISOString().slice(0, 10));
        o.items.forEach(i => console.log('  - ' + (i.product?.brand || '') + ' ' + (i.product?.model || i.product?.name || '') + ' x' + i.quantity + ' $' + i.price));
    });
    console.log('Total sales: ' + orders.length);

    // Users
    const users = await p.user.findMany({ select: { id: true, name: true, role: true } });
    console.log('\n=== USERS ===');
    users.forEach(u => console.log(u.id + ' | ' + u.name + ' | ' + u.role));
}

main().finally(() => p.$disconnect());
