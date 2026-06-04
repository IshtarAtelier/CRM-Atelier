/**
 * Seed script to create the "Teñido" addon product and default crystal colors.
 * Run with: npx tsx prisma/seed-crystal-colors.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // 1. Create "Teñido" addon product (separate from existing "Orgánico blanco teñido")
    const existing = await prisma.product.findFirst({
        where: { name: 'Teñido', type: 'ADDON' }
    });

    if (existing) {
        console.log(`✅ Producto addon "Teñido" ya existe: ${existing.id}`);
    } else {
        const product = await prisma.product.create({
            data: {
                name: 'Teñido',
                category: 'Cristal',
                type: 'ADDON',
                brand: 'Servicio',
                price: 28000,
                cost: 0,
                stock: 9999,
                unitType: 'SERVICIO',
                botLabel: 'Teñido de cristal',
            }
        });
        console.log(`✅ Producto addon "Teñido" creado: ${product.id} — $28,000`);
    }

    // 2. Create default crystal colors in each category
    const defaultColors = [
        { name: 'Gris', hexColor: '#808080', sortOrder: 1 },
        { name: 'Verde', hexColor: '#228B22', sortOrder: 2 },
        { name: 'Sepia', hexColor: '#704214', sortOrder: 3 },
        { name: 'G15', hexColor: '#3B5323', sortOrder: 4 },
        { name: 'Night Drive', hexColor: '#FFD700', sortOrder: 5 },
        { name: 'Azul', hexColor: '#4169E1', sortOrder: 6 },
        { name: 'Rosa', hexColor: '#FF69B4', sortOrder: 7 },
        { name: 'Rojo', hexColor: '#DC143C', sortOrder: 8 },
    ];

    const categories = ['COMPACTO', 'MUESTRA', 'DEGRADE'];

    for (const color of defaultColors) {
        for (const category of categories) {
            try {
                await prisma.crystalColor.upsert({
                    where: { name_category: { name: color.name, category } },
                    update: {},
                    create: {
                        name: color.name,
                        category,
                        hexColor: color.hexColor,
                        sortOrder: color.sortOrder,
                    }
                });
                console.log(`  ✅ Color "${color.name}" (${category})`);
            } catch (e: any) {
                console.log(`  ⏭️  Color "${color.name}" (${category}) — ${e.message?.slice(0, 50)}`);
            }
        }
    }

    console.log('\n🎉 Seed completado!');
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());

