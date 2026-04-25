import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: "postgresql://postgres:RrPSyEGtnMDeqWUAqHKGEIEHUmPcBSAL@interchange.proxy.rlwy.net:12759/railway"
});

async function main() {
    console.log("Iniciando migración de tipos de cristal...");
    
    // First, fix any lingering LENS category
    const resLens = await prisma.product.updateMany({
        where: { category: 'LENS' },
        data: { category: 'Cristal' }
    });
    console.log(`- Cambiados ${resLens.count} productos de category LENS -> Cristal`);

    // Fetch all cristales
    const cristales = await prisma.product.findMany({
        where: {
            category: 'Cristal'
        }
    });

    let updatedCount = 0;

    for (const p of cristales) {
        let newType = p.type;
        const nameUpper = (p.name || '').toUpperCase();
        const typeUpper = (p.type || '').toUpperCase();
        
        const isMulti = /MULTIFOCAL|VARILUX|PHYSIO|COMFORT|XR|LIBERTY|UNIQUE|PRECISE|NETWORK|PROGRESIVO/.test(nameUpper) || /MULTIFOCAL/.test(typeUpper);
        const isBifo = /BIFOCAL|FLAT TOP|KR/.test(nameUpper) || /BIFOCAL/.test(typeUpper);
        const isOcupa = /OCUPACIONAL|INTERVIEW|DIGITIME|OFFICE/.test(nameUpper) || /OCUPACIONAL/.test(typeUpper);
        
        if (isMulti) {
            newType = 'Cristal Multifocal';
        } else if (isBifo) {
            newType = 'Cristal Bifocal';
        } else if (isOcupa) {
            newType = 'Cristal Ocupacional';
        } else if (!p.type || p.type === 'Cristal') {
            // If it has no type and didn't match the special ones, it's Monofocal
            newType = 'Cristal Monofocal';
        } else if (p.type && !p.type.startsWith('Cristal')) {
             // If type was something like "MONOFOCAL", normalize it
             const sub = p.type.charAt(0).toUpperCase() + p.type.slice(1).toLowerCase();
             newType = `Cristal ${sub}`;
        }

        if (newType !== p.type) {
            await prisma.product.update({
                where: { id: p.id },
                data: { type: newType }
            });
            console.log(`Corregido: [${p.id}] ${p.name} | Tipo: ${p.type} -> ${newType}`);
            updatedCount++;
        }
    }

    console.log(`\nMigración terminada. Se actualizaron los tipos de ${updatedCount} cristales.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
