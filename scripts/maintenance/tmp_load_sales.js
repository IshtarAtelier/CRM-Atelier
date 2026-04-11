const { PrismaClient } = require('./prisma/generated/client');
const p = new PrismaClient();

const MATIAS_ID = 'cmml9hp7s0001orog6eu65zlk';

async function findClient(name) {
    const c = await p.client.findFirst({ where: { name } });
    if (!c) throw new Error('Client not found: ' + name);
    return c.id;
}

async function findProduct(brand, nameFragment) {
    const prod = await p.product.findFirst({
        where: { brand, name: { contains: nameFragment } }
    });
    if (!prod) throw new Error('Product not found: ' + brand + ' / ' + nameFragment);
    return prod;
}

async function createSaleProduct(data) {
    return await p.product.create({ data });
}

async function main() {
    // ========================================
    // STEP 1: Delete fictitious sales
    // ========================================
    console.log('=== DELETING FICTITIOUS SALES ===');
    const fakeSales = await p.order.findMany({
        where: { orderType: 'SALE', isDeleted: false },
        select: { id: true, client: { select: { name: true } }, total: true }
    });
    for (const sale of fakeSales) {
        await p.payment.deleteMany({ where: { orderId: sale.id } });
        await p.orderItem.deleteMany({ where: { orderId: sale.id } });
        await p.order.delete({ where: { id: sale.id } });
        console.log('DELETED: ' + sale.client.name + ' $' + sale.total);
    }

    // ========================================
    // STEP 2: Ensure needed products exist
    // ========================================
    console.log('\n=== ENSURING PRODUCTS EXIST ===');

    // Create missing products for some sales
    let carolinaEmanuel = await p.product.findFirst({ where: { name: { contains: 'CAROLINA EMANUEL' } } });
    if (!carolinaEmanuel) {
        carolinaEmanuel = await createSaleProduct({
            category: 'Anteojo de Sol', type: 'Solar', brand: 'Carolina Emanuel',
            name: 'CAROLINA EMANUEL SOL', price: 220000, cost: 0, stock: 0, unitType: 'UNIDAD'
        });
        console.log('Created product: CAROLINA EMANUEL SOL');
    }

    let paseCristales = await p.product.findFirst({ where: { name: { contains: 'Pase de cristales' } } });
    if (!paseCristales) {
        paseCristales = await createSaleProduct({
            category: 'Servicio', type: 'Servicio', brand: 'Atelier',
            name: 'Pase de cristales', price: 20000, cost: 0, stock: 0, unitType: 'UNIDAD'
        });
        console.log('Created product: Pase de cristales');
    }

    // Find crystal products for matching
    const cristalBlueStock = await findProduct('Smart', 'Blue Antirreflejo (Stock)');
    const cristal160Stock = await findProduct('Smart', 'Super Blue Asf');
    const poliBlanco = await findProduct('Smart', 'Policarbonato Blanco');
    const organico156 = await findProduct('Smart', 'Blue Antirreflejo (Stock)');

    // Find a Sygnus multifocal for Oscar Hermann
    const sygnusMulti = await p.product.findFirst({
        where: { brand: 'Sygnus', type: 'Cristal Multifocal' }
    });

    // ========================================
    // STEP 3: Create sales
    // ========================================
    console.log('\n=== CREATING SALES ===');

    const sales = [
        // Venta 1 — 02/03 — Santiago
        {
            date: new Date('2026-03-02'),
            clientName: 'Santiago',
            productId: cristalBlueStock.id,
            total: 80000,
            itemPrice: 80000,
            payments: [
                // No payment yet - saldo pendiente $80,000
            ],
            status: 'PENDING',
        },
        // Venta 3 — 02/03 — Gaston Bodart
        {
            date: new Date('2026-03-02'),
            clientName: 'Gaston Bodart',
            productId: cristalBlueStock.id,
            total: 211700,
            itemPrice: 211700,
            payments: [
                { amount: 211700, method: 'Pay Way 6 Ish' }
            ],
            status: 'PAID',
        },
        // Venta 4 — 03/03 — Martina Svetlitza
        {
            date: new Date('2026-03-03'),
            clientName: 'Martina Svetlitza',
            productId: cristal160Stock.id,
            total: 282000,
            itemPrice: 282000,
            payments: [
                { amount: 282000, method: 'Naranja Z Ish' }
            ],
            status: 'PAID',
        },
        // Venta 5 — 03/03 — Victoria Rueda
        {
            date: new Date('2026-03-03'),
            clientName: 'Victoria Rueda',
            productId: cristalBlueStock.id,
            total: 210000,
            itemPrice: 210000,
            payments: [
                { amount: 210000, method: 'Pay Way 6 Ish' }
            ],
            status: 'PAID',
        },
        // Venta 6 — 03/03 — Vilma Dominguez (sol)
        {
            date: new Date('2026-03-03'),
            clientName: 'Vilma Dominguez',
            productId: carolinaEmanuel.id,
            total: 220000,
            itemPrice: 220000,
            payments: [
                { amount: 220000, method: 'Naranja Z Ish' }
            ],
            status: 'PAID',
        },
        // Venta 7 — 04/03 — Ivan Marusich (1 sola venta)
        {
            date: new Date('2026-03-04'),
            clientName: 'Ivan Marusich',
            productId: cristal160Stock.id,
            total: 637000,
            itemPrice: 637000,
            payments: [
                { amount: 637000, method: 'Pay Way 6 Ish' }
            ],
            status: 'PAID',
        },
        // Venta 8 — 04/03 — Yamila Divanian (Pase)
        {
            date: new Date('2026-03-04'),
            clientName: 'Yamila Divanian',
            productId: paseCristales.id,
            total: 20000,
            itemPrice: 20000,
            payments: [
                { amount: 20000, method: 'Transferencia' }
            ],
            status: 'PAID',
        },
        // Venta 9 — 04/03 — Lara Di Renzo
        {
            date: new Date('2026-03-04'),
            clientName: 'Lara Di Renzo',
            productId: cristalBlueStock.id,
            total: 265000,
            itemPrice: 265000,
            payments: [
                { amount: 265000, method: 'Pay Way 6 Ish' }
            ],
            status: 'PAID',
        },
        // Venta 10 — 04/03 — Marisa Giuliani
        {
            date: new Date('2026-03-04'),
            clientName: 'Marisa Giuliani',
            productId: organico156.id,
            total: 306000,
            itemPrice: 306000,
            payments: [
                { amount: 306000, method: 'Transferencia' }
            ],
            status: 'PAID',
        },
        // Venta 11 — 04/03 — Oscar Hermann (Multifocal, saldo pendiente)
        {
            date: new Date('2026-03-04'),
            clientName: 'Oscar Hermann',
            productId: sygnusMulti.id,
            total: 968000,
            itemPrice: 968000,
            payments: [
                { amount: 400000, method: 'Transferencia' }
            ],
            status: 'PENDING',
        },
        // Venta 12 — 06/03 — Cintia Cabrera (saldo pendiente)
        {
            date: new Date('2026-03-06'),
            clientName: 'Cintia Cabrera',
            productId: cristal160Stock.id,
            total: 127400,
            itemPrice: 127400,
            payments: [
                { amount: 50000, method: 'Transferencia' }
            ],
            status: 'PENDING',
        },
        // Venta 13 — 06/03 — Luisiana Herrera
        {
            date: new Date('2026-03-06'),
            clientName: 'Luisiana Herrera',
            productId: poliBlanco.id,
            total: 230000,
            itemPrice: 230000,
            payments: [
                { amount: 230000, method: 'Pay Way 6 Ish' }
            ],
            status: 'PAID',
        },
        // Venta 14 — 09/03 — Caro Conti
        {
            date: new Date('2026-03-09'),
            clientName: 'Caro Conti',
            productId: organico156.id,
            total: 396000,
            itemPrice: 396000,
            payments: [
                { amount: 396000, method: 'Pay Way 3 Ish' }
            ],
            status: 'PAID',
        },
    ];

    let created = 0;
    for (const sale of sales) {
        const clientId = await findClient(sale.clientName);
        const totalPaid = sale.payments.reduce((sum, pay) => sum + pay.amount, 0);

        const order = await p.order.create({
            data: {
                clientId,
                userId: MATIAS_ID,
                status: sale.status,
                total: sale.total,
                paid: totalPaid,
                orderType: 'SALE',
                labStatus: 'NONE',
                discount: 0,
                createdAt: sale.date,
                updatedAt: sale.date,
                items: {
                    create: [{
                        productId: sale.productId,
                        quantity: 1,
                        price: sale.itemPrice,
                    }]
                },
                payments: {
                    create: sale.payments.map(pay => ({
                        amount: pay.amount,
                        method: pay.method,
                        date: sale.date,
                    }))
                }
            }
        });

        created++;
        const saldoInfo = totalPaid < sale.total ? ' (saldo: $' + (sale.total - totalPaid) + ')' : '';
        console.log('OK: ' + sale.clientName + ' | $' + sale.total + ' | ' + sale.status + saldoInfo);
    }

    console.log('\nDone! Created ' + created + ' sales.');
}

main().finally(() => p.$disconnect());
