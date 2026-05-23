const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const PROD_URL = "postgresql://postgres:JqNVkEgwNDmTidZHmZdmlxLTnlxrBsYT@crossover.proxy.rlwy.net:16284/railway";
const ARTIFACT_PATH = "/Users/ishtarpissano/.gemini/antigravity/brain/a8d97409-2017-4b1f-9a8b-e268168a1fbe/optovision_production_prices.md";

async function main() {
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();

    // Fetch all products where laboratory is "optovision"
    const optovisionProducts = await prod.product.findMany({
        where: {
            laboratory: {
                contains: 'optovision',
                mode: 'insensitive'
            }
        },
        orderBy: {
            name: 'asc'
        }
    });

    let markdown = `# Precios de Laboratorio Optovision (Producción)\n\n`;
    markdown += `> [!INFO]\n> Este reporte contiene todos los productos en la base de datos de producción cuyo laboratorio es **Optovision**.\n\n`;
    markdown += `Se encontraron **${optovisionProducts.length}** productos.\n\n`;

    markdown += `| Categoría | Producto | Precio | Costo | Stock |\n`;
    markdown += `|---|---|---|---|---|\n`;

    for (const p of optovisionProducts) {
        markdown += `| ${p.category} | ${p.name} | $${p.price.toLocaleString('es-AR')} | $${p.cost.toLocaleString('es-AR')} | ${p.stock} |\n`;
    }

    // Now products that have optovision in the name but aren't in the lab
    const nameMatchProducts = await prod.product.findMany({
        where: {
            name: {
                contains: 'optovision',
                mode: 'insensitive'
            },
            NOT: {
                laboratory: {
                    contains: 'optovision',
                    mode: 'insensitive'
                }
            }
        },
        orderBy: {
            name: 'asc'
        }
    });

    if (nameMatchProducts.length > 0) {
        markdown += `\n## Productos con "Optovision" en el nombre (Otro laboratorio)\n\n`;
        markdown += `| Categoría | Producto | Laboratorio | Precio | Costo | Stock |\n`;
        markdown += `|---|---|---|---|---|---|\n`;
        for (const p of nameMatchProducts) {
            markdown += `| ${p.category} | ${p.name} | ${p.laboratory || 'N/A'} | $${p.price.toLocaleString('es-AR')} | $${p.cost.toLocaleString('es-AR')} | ${p.stock} |\n`;
        }
    }

    fs.writeFileSync(ARTIFACT_PATH, markdown, 'utf-8');
    console.log("Artifact created successfully at", ARTIFACT_PATH);

    await prod.$disconnect();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
