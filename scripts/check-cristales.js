const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Manually parse .env
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8');
    const lines = envFile.split('\n');
    for (const line of lines) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
            const key = match[1];
            let value = match[2] || '';
            
            // Remove comments at the end
            const hashIndex = value.indexOf('#');
            if (hashIndex !== -1) {
                value = value.substring(0, hashIndex);
            }
            value = value.trim();
            // remove quotes
            if (value.length > 1 && value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1);
            } else if (value.length > 1 && value.startsWith("'") && value.endsWith("'")) {
                value = value.substring(1, value.length - 1);
            }
            process.env[key] = value;
        }
    }
}

// Override DATABASE_URL with PROD_DATABASE_URL
if (process.env.PROD_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.PROD_DATABASE_URL;
}

const prisma = new PrismaClient();

async function checkCristales() {
    console.log("Iniciando revisión de cristales...");

    const cristales = await prisma.product.findMany({
        where: {
            category: { in: ['Cristal', 'LENS'] },
        }
    });

    console.log(`Total de cristales encontrados: ${cristales.length}`);

    // 1. Check for duplicates
    // We group by name + brand + model
    const grouped = {};
    for (const c of cristales) {
        const key = `${c.name || ''}|${c.brand || ''}|${c.model || ''}`;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(c);
    }

    const duplicates = Object.values(grouped).filter(group => group.length > 1);
    if (duplicates.length > 0) {
        console.log(`\n--- POSIBLES DUPLICADOS (${duplicates.length} grupos) ---`);
        for (const group of duplicates) {
            console.log(`- Duplicado detectado para: Nombre: "${group[0].name}", Marca: "${group[0].brand}", Modelo: "${group[0].model}"`);
            for (const item of group) {
                console.log(`   * ID: ${item.id} | Precio: $${item.price} | Laboratorio: ${item.laboratory}`);
            }
        }
    } else {
        console.log("\n--- No se encontraron duplicados ---");
    }

    // 2. Check for missing data
    console.log(`\n--- CRISTALES CON DATOS FALTANTES ---`);
    let missingCount = 0;
    for (const c of cristales) {
        const missing = [];
        if (!c.name) missing.push('Nombre');
        if (!c.brand) missing.push('Marca');
        if (!c.type) missing.push('Tipo');
        if (!c.laboratory) missing.push('Laboratorio');
        if (c.price === undefined || c.price === null || c.price === 0) missing.push('Precio ($0)');
        
        if (missing.length > 0) {
            missingCount++;
            console.log(`- ID: ${c.id} | Nombre: "${c.name || 'SIN NOMBRE'}" | Faltan: ${missing.join(', ')}`);
        }
    }

    if (missingCount === 0) {
        console.log("Todos los cristales tienen los datos de carga completos.");
    } else {
        console.log(`\nTotal con datos faltantes: ${missingCount}`);
    }

    await prisma.$disconnect();
}

checkCristales().catch(e => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
});
