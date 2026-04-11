const { PrismaClient } = require('@prisma/client');

const PROD_URL = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";

async function main() {
    console.log('🔍 Auditando datos de Cristales en Producción...\n');
    
    const prisma = new PrismaClient({
        datasources: {
            db: { url: PROD_URL }
        }
    });

    try {
        await prisma.$connect();
        
        // 1. Buscar todos los cristales
        const allLenses = await prisma.product.findMany({
            where: {
                OR: [
                    { category: 'Cristal' },
                    { category: 'LENS' },
                    { type: { startsWith: 'Cristal' } }
                ]
            }
        });

        const total = allLenses.length;
        const missingIndex = allLenses.filter(p => !p.lensIndex || p.lensIndex.trim() === '');
        const withIndex = allLenses.length - missingIndex.length;

        console.log(`📊 Total de Cristales: ${total}`);
        console.log(`✅ Con Índice: ${withIndex}`);
        console.log(`❌ Sin Índice: ${missingIndex.length}`);

        if (missingIndex.length > 0) {
            console.log('\n📋 Cristales sin índice cargado:');
            missingIndex.forEach(p => {
                console.log(`- [${p.id}] ${p.brand || 'Sin Marca'} ${p.name || ''} (${p.type || 'Sin Tipo'})`);
            });
        } else {
            console.log('\n✨ ¡Excelente! Todos los cristales tienen su índice cargado.');
        }

    } catch (error) {
        console.error('❌ Error durante el audit:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
