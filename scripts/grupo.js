const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ datasources: { db: { url: 'postgresql://postgres:RrPSyEGtnMDeqWUAqHKGEIEHUmPcBSAL@interchange.proxy.rlwy.net:12759/railway' } } });

async function run() {
    const orders = await prisma.order.findMany({
        where: { orderType: 'SALE', isDeleted: false },
        include: {
            client: true,
            items: {
                include: { product: true }
            }
        }
    });

    const clientCosts = {};
    let totalCostGrupoOptico = 0;

    for (const order of orders) {
        let orderCostForGrupoOptico = 0;
        let itemDetails = [];

        for (const item of order.items) {
            const product = item.product;
            if (!product) continue;

            const labName = product.laboratory;
            const cat = (product.category || '').toUpperCase();
            const isLens = cat.includes('LENS') || (product.type || '').includes('Cristal') || (product.type || '').includes('Multifocal') || (product.type || '').includes('Monofocal');

            if (isLens && labName === 'GRUPO OPTICO') {
                let itemCost = (product.cost || 0) * item.quantity;
                
                if (product.unitType === 'PAR' && item.eye && (product.cost || 0) > 0) {
                    itemCost = ((product.cost || 0) / 2) * item.quantity;
                }

                const is2x1Order = ((order.appliedPromoName || '')).toLowerCase().includes('2x1');
                if (is2x1Order && item.price === 0) {
                    itemCost = 0;
                }

                if (itemCost > 0) {
                    orderCostForGrupoOptico += itemCost;
                    itemDetails.push(product.name + ' ($' + itemCost + ')');
                }
            }
        }

        if (orderCostForGrupoOptico > 0) {
            const clientName = order.client?.name || 'Desconocido';
            totalCostGrupoOptico += orderCostForGrupoOptico;
            if (!clientCosts[clientName]) clientCosts[clientName] = 0;
            clientCosts[clientName] += orderCostForGrupoOptico;
            console.log('- Cliente: ' + clientName + ' | Costo: $' + orderCostForGrupoOptico + ' | Ítems: ' + itemDetails.join(', '));
        }
    }
    console.log('\n--- Resumen ---');
    console.log('Total Costo GRUPO OPTICO:', totalCostGrupoOptico);
}

run().catch(console.error).finally(() => process.exit(0));
