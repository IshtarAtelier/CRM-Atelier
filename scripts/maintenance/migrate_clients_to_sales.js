const { PrismaClient } = require('./prisma/generated/client');
const p = new PrismaClient();

async function main() {
    try {
    console.log('=== Migracion: Clientes importados -> Ventas ===\n');

    // 1. Get the first ADMIN user to assign as seller
    const admins = await p.user.findMany({ where: { role: 'ADMIN' }, take: 1 });
    if (admins.length === 0) {
        console.error('ERROR: No se encontro un usuario ADMIN. Abortando.');
        return;
    }
    const adminUser = admins[0];
    console.log('Vendedor asignado: ' + adminUser.name + ' (' + adminUser.id + ')\n');

    // 2. Find clients with status CLIENT
    const clientsByStatus = await p.client.findMany({
        where: { status: 'CLIENT' },
        include: {
            orders: { select: { id: true, orderType: true } },
            tags: { select: { name: true } },
        },
    });

    // 3. Find clients tagged "Ya es cliente"
    const tag = await p.tag.findUnique({ where: { name: 'Ya es cliente' } });
    let clientsByTag = [];
    if (tag) {
        clientsByTag = await p.client.findMany({
            where: { tags: { some: { id: tag.id } } },
            include: {
                orders: { select: { id: true, orderType: true } },
                tags: { select: { name: true } },
            },
        });
    }

    // 4. Merge and deduplicate
    const clientMap = new Map();
    for (const c of [...clientsByStatus, ...clientsByTag]) {
        clientMap.set(c.id, c);
    }
    const clients = Array.from(clientMap.values());

    console.log('Clientes encontrados: ' + clients.length + '\n');

    let created = 0;
    let skipped = 0;

    for (const client of clients) {
        // Skip if client already has a SALE order
        const hasSale = client.orders.some(o => o.orderType === 'SALE');
        if (hasSale) {
            console.log('SKIP (ya tiene venta): ' + client.name);
            skipped++;
            continue;
        }

        // Create the historical sale order
        const order = await p.order.create({
            data: {
                clientId: client.id,
                userId: adminUser.id,
                status: 'COMPLETED',
                orderType: 'SALE',
                labStatus: 'DELIVERED',
                total: 0,
                paid: 0,
            },
        });

        // Register interaction in client history
        await p.interaction.create({
            data: {
                clientId: client.id,
                type: 'NOTE',
                content: 'Venta historica registrada (sistema anterior) - Sin detalle de productos',
            },
        });

        // Ensure client status is CLIENT
        if (client.status !== 'CLIENT') {
            await p.client.update({
                where: { id: client.id },
                data: { status: 'CLIENT' },
            });
        }

        console.log('CREADA: ' + client.name + ' -> Venta #' + order.id.slice(-4).toUpperCase());
        created++;
    }

    console.log('\n=== Resumen ===');
    console.log('Total clientes procesados: ' + clients.length);
    console.log('Ventas creadas: ' + created);
    console.log('Omitidos (ya tenian venta): ' + skipped);
    console.log('\nMigracion completada.');
    } catch (err) {
        console.error('ERROR en migracion:', err.message || err);
        if (err.meta) console.error('Meta:', JSON.stringify(err.meta));
    }
}

main().finally(function() { return p['$disconnect'](); });
