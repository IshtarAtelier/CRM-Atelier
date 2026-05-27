require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const PROD_URL = process.env.PROD_DATABASE_URL;
const ARTIFACT_PATH = "/Users/ishtarpissano/.gemini/antigravity/brain/a8d97409-2017-4b1f-9a8b-e268168a1fbe/varilux_xr_markup_prices.md";

async function main() {
    console.log("Connecting to Production Database...");
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    await prod.$connect();

    // Fetch all products where name contains "xr"
    const xrProducts = await prod.product.findMany({
        where: {
            name: {
                contains: 'xr',
                mode: 'insensitive'
            },
            laboratory: {
                contains: 'optovision',
                mode: 'insensitive'
            }
        },
        orderBy: {
            name: 'asc'
        }
    });

    let markdown = `# Precios y Markup - Varilux XR (Optovision)\n\n`;
    markdown += `> [!INFO]\n> Este reporte contiene los productos de la familia **Varilux XR** del laboratorio Optovision, detallando su costo, precio y el markup calculado.\n\n`;
    markdown += `Se encontraron **${xrProducts.length}** productos.\n\n`;

    markdown += `| Producto | Costo | Markup Calculado | Precio de Venta |\n`;
    markdown += `|---|---|---|---|\n`;

    for (const p of xrProducts) {
        let markupCalc = 0;
        let markupText = "-";
        
        if (p.cost > 0) {
            markupCalc = p.price / p.cost;
            markupText = markupCalc.toFixed(2) + "x"; 
            // Alternatively: ((p.price - p.cost) / p.cost * 100).toFixed(2) + "%"
        } else if (p.price > 0) {
            markupText = "Infinito (Costo 0)";
        }

        markdown += `| ${p.name} | $${p.cost.toLocaleString('es-AR')} | **${markupText}** | $${p.price.toLocaleString('es-AR')} |\n`;
    }

    fs.writeFileSync(ARTIFACT_PATH, markdown, 'utf-8');
    console.log("Artifact created successfully at", ARTIFACT_PATH);

    await prod.$disconnect();
}

main().catch(e => {
    console.error(e);
    process.exit(1);
});
