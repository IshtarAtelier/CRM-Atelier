const { loadEnvConfig } = require('@next/env');
const { PrismaClient } = require('@prisma/client');
const path = require('path');

const projectDir = path.join(__dirname, '..');
loadEnvConfig(projectDir);

const prisma = new PrismaClient();

async function fixCristales() {
    console.log("Iniciando reparación de cristales...");

    const cristales = await prisma.product.findMany({
        where: {
            category: { in: ['Cristal', 'LENS'] },
        }
    });

    let updatedCount = 0;

    for (const c of cristales) {
        let dataToUpdate = {};
        const upperName = (c.name || '').toUpperCase();

        // Fix Type
        if (!c.type) {
            if (upperName.includes('UNIQUE') || upperName.includes('PRECISE') || 
                upperName.includes('COMFORT') || upperName.includes('PHYSIO') || 
                upperName.includes('XR DESIGN') || upperName.includes('KODAK') || upperName.includes('VARILUX')) {
                dataToUpdate.type = 'Multifocal';
            } else if (upperName.includes('FLAT TOP') || upperName.includes('BIFOCAL')) {
                dataToUpdate.type = 'Bifocal';
            } else if (upperName.includes('MONOFOCAL')) {
                dataToUpdate.type = 'Monofocal';
            } else {
                dataToUpdate.type = 'Monofocal'; // Default to Monofocal if unknown
            }
        }

        // Fix Laboratory
        if (!c.laboratory) {
            if (upperName.includes('LA CAMARA')) {
                dataToUpdate.laboratory = 'LA CAMARA';
            } else if (upperName.includes('GRUPO')) {
                dataToUpdate.laboratory = 'GRUPO OPTICO';
            } else {
                dataToUpdate.laboratory = 'OTRO';
            }
        }

        if (Object.keys(dataToUpdate).length > 0) {
            await prisma.product.update({
                where: { id: c.id },
                data: dataToUpdate
            });
            updatedCount++;
            console.log(`- Actualizado ID: ${c.id} | Nombre: ${c.name} | Set: ${JSON.stringify(dataToUpdate)}`);
        }
    }

    console.log(`\nTotal de cristales reparados: ${updatedCount}`);
    await prisma.$disconnect();
}

fixCristales().catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
});
