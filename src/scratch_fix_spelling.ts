import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: "postgresql://postgres:RrPSyEGtnMDeqWUAqHKGEIEHUmPcBSAL@interchange.proxy.rlwy.net:12759/railway"
});

async function main() {
    console.log("Unificando y corrigiendo nombres de SMART FREE...");
    
    const products = await prisma.product.findMany({
        where: { name: { contains: 'SMART FREE' } }
    });

    for (const p of products) {
        if (!p.name) continue;

        let newName = p.name;
        
        // Corregir errores ortográficos comunes
        newName = newName.replace(/Oraganico/gi, 'Orgánico');
        newName = newName.replace(/Organico/gi, 'Orgánico');
        newName = newName.replace(/Ligth/gi, 'Light');
        newName = newName.replace(/Fotocoromatico/gi, 'Fotocromático');
        newName = newName.replace(/Fotocromatico/gi, 'Fotocromático');
        newName = newName.replace(/Ar essential/gi, 'AR Essential');
        newName = newName.replace(/Ar Essential/gi, 'AR Essential');
        newName = newName.replace(/ ,/g, ',');
        newName = newName.replace(/  +/g, ' '); // quitar dobles espacios

        if (newName !== p.name) {
            await prisma.product.update({
                where: { id: p.id },
                data: { name: newName }
            });
            console.log(`Corregido:`);
            console.log(`  De:   ${p.name}`);
            console.log(`  Para: ${newName}`);
        }
    }

    console.log("Corrección terminada.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
