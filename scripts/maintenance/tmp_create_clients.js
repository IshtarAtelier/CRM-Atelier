const { PrismaClient } = require('./prisma/generated/client');
const p = new PrismaClient();

async function main() {
    const clients = [
        { name: 'Santiago', interest: 'Monofocal', contactSource: 'Calle', status: 'CLIENT' },
        { name: 'Gaston Bodart', interest: 'Monofocal', contactSource: 'Calle', status: 'CLIENT' },
        { name: 'Martina Svetlitza', interest: 'Monofocal', contactSource: 'Calle', status: 'CLIENT' },
        { name: 'Victoria Rueda', interest: 'Monofocal', contactSource: 'Calle', status: 'CLIENT' },
        { name: 'Vilma Dominguez', interest: 'Solar', contactSource: 'Calle', status: 'CLIENT' },
        { name: 'Ivan Marusich', interest: 'Monofocal', contactSource: 'Calle', status: 'CLIENT' },
        { name: 'Lu Marusich', interest: 'Monofocal', contactSource: 'Calle', status: 'CLIENT' },
        { name: 'Yamila Divanian', interest: 'Monofocal', contactSource: 'Calle', status: 'CLIENT' },
        { name: 'Lara Di Renzo', interest: 'Monofocal', contactSource: 'Calle', status: 'CLIENT' },
        { name: 'Marisa Giuliani', interest: 'Monofocal', contactSource: 'Calle', status: 'CLIENT' },
        { name: 'Oscar Hermann', interest: 'Multifocal', contactSource: 'Calle', status: 'CLIENT' },
        { name: 'Cintia Cabrera', interest: 'Monofocal', contactSource: 'Calle', status: 'CLIENT' },
        { name: 'Luisiana Herrera', interest: 'Monofocal', contactSource: 'Calle', status: 'CLIENT' },
        { name: 'Caro Conti', interest: 'Monofocal', contactSource: 'Calle', status: 'CLIENT' },
    ];

    console.log('Creating ' + clients.length + ' clients...\n');

    for (const c of clients) {
        // Check if already exists
        const existing = await p.client.findFirst({ where: { name: c.name } });
        if (existing) {
            console.log('SKIP (already exists): ' + c.name + ' -> ' + existing.id);
            continue;
        }

        const created = await p.client.create({
            data: {
                name: c.name,
                interest: c.interest,
                contactSource: c.contactSource,
                status: c.status,
            }
        });
        console.log('CREATED: ' + created.name + ' -> ' + created.id);
    }

    console.log('\nDone!');
}

main().finally(() => p.$disconnect());
