const path = require('path');
const fs = require('fs');

// Load environment variables from the project's .env file
const projectEnv = path.resolve(__dirname, '../../.env');
if (fs.existsSync(projectEnv)) {
    fs.readFileSync(projectEnv, 'utf8').split('\n').forEach(line => {
        const [key, ...vals] = line.split('=');
        if (key && !key.startsWith('#') && vals.length) {
            process.env[key.trim()] = vals.join('=').trim().replace(/^["']|["']$/g, '');
        }
    });
}

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } }
});

function normalizeContactSource(source) {
    if (!source || source.trim() === "") return null;
    const clean = source.trim();
    const lower = clean.toLowerCase();
    if (lower.includes('google') || lower === 'gads') {
        return 'Google Ads';
    } else if (
        lower.includes('meta') || 
        lower.includes('instagram') || 
        lower.includes('facebook') || 
        lower === 'face' || 
        lower === 'fb' || 
        lower === 'ig'
    ) {
        return 'Meta';
    } else if (lower.includes('ya es cliente') || lower === 'cliente' || lower === 'antiguo') {
        return 'Ya es Cliente';
    }
    return clean;
}

const tagConfigs = {
    'Google Ads': { name: 'Google Ads', color: '#1677ff' },
    'Meta': { name: 'Meta Ads', color: '#E91E63' },
    'Ya es Cliente': { name: 'Ya es cliente', color: '#4CAF50' }
};

async function main() {
    console.log('--- Iniciando normalización histórica de orígenes de contacto ---');
    const isDryRun = process.argv.includes('--dry-run');
    if (isDryRun) {
        console.log('⚠️ Modo SIMULACIÓN (dry-run). No se realizarán cambios en la base de datos.');
    }

    // Obtener todos los clientes activos
    const clients = await prisma.client.findMany({
        where: { isDeleted: false },
        select: {
            id: true,
            name: true,
            contactSource: true,
            tags: { select: { name: true } }
        }
    });

    console.log(`Se encontraron ${clients.length} clientes activos para procesar.`);

    let updatedCount = 0;
    let tagConnectedCount = 0;

    for (const client of clients) {
        const originalSource = client.contactSource;
        const normalizedSource = normalizeContactSource(originalSource);

        const sourceChanged = originalSource !== normalizedSource;
        const tagConfig = tagConfigs[normalizedSource];
        
        let needsTagConnection = false;
        if (tagConfig) {
            const hasTag = client.tags.some(t => t.name === tagConfig.name);
            if (!hasTag) {
                needsTagConnection = true;
            }
        }

        if (sourceChanged || needsTagConnection) {
            console.log(`Cliente: "${client.name}" (${client.id})`);
            if (sourceChanged) {
                console.log(`  - Origen: "${originalSource}" -> "${normalizedSource}"`);
            }
            if (needsTagConnection) {
                console.log(`  - Asociar etiqueta: "${tagConfig.name}"`);
            }

            if (!isDryRun) {
                try {
                    const updateData = {};
                    if (sourceChanged) {
                        updateData.contactSource = normalizedSource;
                    }

                    if (needsTagConnection && tagConfig) {
                        const tag = await prisma.tag.upsert({
                            where: { name: tagConfig.name },
                            update: {},
                            create: { name: tagConfig.name, color: tagConfig.color }
                        });
                        updateData.tags = { connect: { id: tag.id } };
                        tagConnectedCount++;
                    }

                    await prisma.client.update({
                        where: { id: client.id },
                        data: updateData
                    });
                    updatedCount++;
                } catch (err) {
                    console.error(`❌ Error actualizando cliente ${client.id}:`, err.message);
                }
            } else {
                if (sourceChanged) updatedCount++;
                if (needsTagConnection) tagConnectedCount++;
            }
        }
    }

    console.log('\n--- Resumen ---');
    console.log(`Clientes normalizados en origen: ${updatedCount}`);
    console.log(`Etiquetas comerciales asociadas/sincronizadas: ${tagConnectedCount}`);
    console.log('--- Proceso finalizado ---');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
