import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasourceUrl: "postgresql://postgres:RrPSyEGtnMDeqWUAqHKGEIEHUmPcBSAL@interchange.proxy.rlwy.net:12759/railway"
});

async function main() {
    console.log("Buscando productos duplicados en la base de datos...");
    
    const products = await prisma.product.findMany();

    const seen = new Map<string, any[]>();

    for (const p of products) {
        // Build a unique key based on the most identifying fields
        const key = [
            (p.brand || '').trim().toUpperCase(),
            (p.name || '').trim().toUpperCase(),
            (p.model || '').trim().toUpperCase(),
            (p.category || '').trim().toUpperCase(),
            (p.type || '').trim().toUpperCase(),
            (p.laboratory || '').trim().toUpperCase(),
            (p.lensIndex || '').trim().toUpperCase(),
            p.is2x1 ? '2X1' : 'NORMAL'
        ].join('|');

        if (!seen.has(key)) {
            seen.set(key, []);
        }
        seen.get(key)!.push(p);
    }

    let duplicateGroups = 0;
    let totalDuplicatesToMerge = 0;

    for (const [key, group] of seen.entries()) {
        if (group.length > 1) {
            duplicateGroups++;
            totalDuplicatesToMerge += (group.length - 1);
            console.log(`\n🔴 DUPLICADO ENCONTRADO (${group.length} veces):`);
            const parts = key.split('|');
            console.log(`   Marca: ${parts[0]} | Nombre: ${parts[1]} | Modelo: ${parts[2]}`);
            console.log(`   Cat: ${parts[3]} | Tipo: ${parts[4]} | Lab: ${parts[5]} | Índice: ${parts[6]} | 2x1: ${parts[7]}`);
            
            group.forEach((dup, index) => {
                console.log(`     [${index + 1}] ID: ${dup.id} | Stock: ${dup.stock} | Precio: $${dup.price} | Creado: ${dup.createdAt.toISOString().split('T')[0]}`);
            });
        }
    }

    if (duplicateGroups === 0) {
        console.log("\n✅ ¡No se encontraron productos duplicados! La base de datos está impecable.");
    } else {
        console.log(`\n⚠️ Se encontraron ${duplicateGroups} grupos de productos duplicados.`);
        console.log(`   Total de registros redundantes que podríamos unificar/eliminar: ${totalDuplicatesToMerge}`);
    }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
