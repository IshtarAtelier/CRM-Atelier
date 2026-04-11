// Load .env manually (no dotenv dependency)
const fs = require('fs');
const path = require('path');
const envPath = path.resolve(__dirname, '.env');
if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
            if (!process.env[key]) process.env[key] = val;
        }
    });
}

const { PrismaClient } = require('./prisma/generated/client');
const prisma = new PrismaClient();

// Mapeo de tipos legacy → nuevos valores
const TYPE_MAP = {
    'MONOFOCAL': 'Cristal Monofocal',
    'MULTIFOCAL': 'Cristal Multifocal',
    'BIFOCAL': 'Cristal Bifocal',
    'OCUPACIONAL': 'Cristal Ocupacional',
    'SOLAR': 'Cristal Solar',
};

async function main() {
    console.log('🔍 Buscando productos con categoría/tipo legacy...\n');

    // 1. Mostrar estado actual
    const allProducts = await prisma.product.findMany({ select: { category: true, type: true } });
    const beforeMap = {};
    allProducts.forEach(p => {
        const key = `${p.category} / ${p.type}`;
        beforeMap[key] = (beforeMap[key] || 0) + 1;
    });
    console.log('Estado ANTES:');
    Object.entries(beforeMap).sort().forEach(([k, v]) => console.log(`  ${k}: ${v}`));

    // 2. Corregir category = 'LENS' → 'Cristal'
    const lensCount = await prisma.product.updateMany({
        where: { category: 'LENS' },
        data: { category: 'Cristal' }
    });
    console.log(`\n✅ Categoría LENS → Cristal: ${lensCount.count} productos actualizados`);

    // 3. Corregir types legacy
    for (const [oldType, newType] of Object.entries(TYPE_MAP)) {
        const updated = await prisma.product.updateMany({
            where: { type: oldType },
            data: { type: newType }
        });
        if (updated.count > 0) {
            console.log(`✅ Tipo ${oldType} → ${newType}: ${updated.count} productos`);
        }
    }

    // 4. Asegurar que productos con type 'Cristal ...' tengan category 'Cristal'
    const crystalTypeProducts = await prisma.product.findMany({
        where: {
            type: { startsWith: 'Cristal' },
            NOT: { category: 'Cristal' }
        },
        select: { id: true }
    });
    if (crystalTypeProducts.length > 0) {
        await prisma.product.updateMany({
            where: { id: { in: crystalTypeProducts.map(p => p.id) } },
            data: { category: 'Cristal' }
        });
        console.log(`✅ Categoría corregida a 'Cristal' para ${crystalTypeProducts.length} productos con type 'Cristal ...'`);
    }

    // 5. Asegurar unitType PAR para cristales sin él
    const fixUnit = await prisma.product.updateMany({
        where: {
            category: 'Cristal',
            NOT: { unitType: 'PAR' }
        },
        data: { unitType: 'PAR' }
    });
    if (fixUnit.count > 0) {
        console.log(`✅ UnitType corregido a PAR para ${fixUnit.count} cristales`);
    }

    // 6. Mostrar estado después
    const afterProducts = await prisma.product.findMany({ select: { category: true, type: true } });
    const afterMap = {};
    afterProducts.forEach(p => {
        const key = `${p.category} / ${p.type}`;
        afterMap[key] = (afterMap[key] || 0) + 1;
    });
    console.log('\nEstado DESPUÉS:');
    Object.entries(afterMap).sort().forEach(([k, v]) => console.log(`  ${k}: ${v}`));

    // 7. Verificar OPTOVISION específicamente
    const optovision = await prisma.product.findMany({
        where: { laboratory: 'OPTOVISION' },
        select: { brand: true, name: true, category: true, type: true, laboratory: true },
        take: 5
    });
    console.log(`\n🔬 Muestra OPTOVISION (${optovision.length} primeros):`);
    optovision.forEach(p => console.log(`  ${p.brand} | ${(p.name || '').substring(0, 50)} | cat:${p.category} | type:${p.type} | lab:${p.laboratory}`));

    console.log('\n✨ ¡Migración completada!');
}

main()
    .catch(e => console.error('❌ Error:', e.message))
    .finally(() => prisma.$disconnect());
