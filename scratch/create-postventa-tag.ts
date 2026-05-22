import { prisma } from '../src/lib/db';

async function createPostVentaTag() {
    const tags = [
        { name: 'Post-venta', color: '#EAB308' }, // Yellow
        { name: 'Cerrado', color: '#10B981' }     // Green
    ];

    for (const tag of tags) {
        await prisma.tag.upsert({
            where: { name: tag.name },
            update: { color: tag.color },
            create: tag
        });
        console.log(`Etiqueta verificada/creada: ${tag.name}`);
    }

    await prisma.$disconnect();
}

createPostVentaTag();
