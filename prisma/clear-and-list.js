const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();

// Los 3 multifocales seleccionados para el bot (identificados de la screenshot)
const botMultifocales = [
    { id: 'cmmxutlms002u10yt64x1bswr', botLabel: 'Varilux Comfort Max – Gama Superior' },
    { id: 'cmmwnv194000r10ytia8m3jpv', botLabel: 'Sygnus Essilor – Gama Media' },
    { id: 'cmmwnv193000l10ytyqli3hny', botLabel: 'Smart Lens Free – Gama Económica' },
];

async function main() {
    // Primero, limpiar cualquier botRecommended anterior en multifocales
    await p.product.updateMany({
        where: { type: { in: ['Multifocal', 'Cristal Multifocal'] } },
        data: { botRecommended: false, botLabel: null }
    });
    console.log('✅ Limpiados flags anteriores');

    // Marcar los 3 seleccionados
    for (const prod of botMultifocales) {
        await p.product.update({
            where: { id: prod.id },
            data: { botRecommended: true, botLabel: prod.botLabel }
        });
        console.log(`✅ Marcado como BOT: ${prod.botLabel}`);
    }

    // Confirmación
    const confirmados = await p.product.findMany({
        where: { botRecommended: true },
        select: { id: true, botLabel: true, price: true }
    });
    console.log('\n🤖 Productos activos para el bot:');
    confirmados.forEach(c => console.log(`  → ${c.botLabel} | $${c.price.toFixed(0)}`));
}

main().catch(console.error).finally(() => p.$disconnect());
