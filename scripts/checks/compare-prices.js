require("dotenv").config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const PROD_URL = process.env.PROD_DATABASE_URL;
const LOCAL_URL = "postgresql://postgres:localpassword@localhost:5432/atelier?schema=public";
const REPORT_PATH = "/Users/ishtarpissano/.gemini/antigravity/brain/2893449a-0c4c-4814-b3d6-6e69df503ca4/pricing_comparison.md";

function formatCurrency(val) {
    if (val === null || val === undefined) return '-';
    return `$${val.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function main() {
    console.log('Connecting to databases...');
    const prod = new PrismaClient({ datasources: { db: { url: PROD_URL } } });
    const local = new PrismaClient({ datasources: { db: { url: LOCAL_URL } } });

    await prod.$connect();
    await local.$connect();
    console.log('Connected.');

    // 1. Fetch ServicePricing
    const prodServices = await prod.servicePricing.findMany({ where: { active: true } });
    const localServices = await local.servicePricing.findMany({ where: { active: true } });

    // 2. Fetch Products
    const prodProducts = await prod.product.findMany({});
    const localProducts = await local.product.findMany({});

    // Process ServicePricing
    const prodServicesMap = new Map(prodServices.map(s => [s.name, s]));
    const localServicesMap = new Map(localServices.map(s => [s.name, s]));
    const allServiceNames = Array.from(new Set([...prodServicesMap.keys(), ...localServicesMap.keys()]));

    const servicesTable = [];
    let servicesDiffCount = 0;

    for (const name of allServiceNames) {
        const prodS = prodServicesMap.get(name);
        const localS = localServicesMap.get(name);

        let status = '';
        let prodCash = null, localCash = null;
        let prodCredit = null, localCredit = null;
        let isDiff = false;

        if (prodS && localS) {
            prodCash = prodS.priceCash;
            localCash = localS.priceCash;
            prodCredit = prodS.priceCredit;
            localCredit = localS.priceCredit;
            isDiff = prodCash !== localCash || prodCredit !== localCredit;
            status = isDiff ? 'Diferente' : 'Idéntico';
            if (isDiff) servicesDiffCount++;
        } else if (prodS) {
            prodCash = prodS.priceCash;
            prodCredit = prodS.priceCredit;
            status = 'Solo en Producción';
            isDiff = true;
            servicesDiffCount++;
        } else {
            localCash = localS.priceCash;
            localCredit = localS.priceCredit;
            status = 'Solo en Local';
            isDiff = true;
            servicesDiffCount++;
        }

        servicesTable.push({
            name,
            category: (prodS || localS).category,
            prodCash,
            localCash,
            prodCredit,
            localCredit,
            status,
            isDiff
        });
    }

    // Process Products
    const prodProductsMap = new Map(prodProducts.map(p => [p.id, p]));
    const localProductsMap = new Map(localProducts.map(p => [p.id, p]));
    const allProductIds = Array.from(new Set([...prodProductsMap.keys(), ...localProductsMap.keys()]));

    const productsTable = [];
    let productsDiffCount = 0;
    let onlyProdProductsCount = 0;
    let onlyLocalProductsCount = 0;

    for (const id of allProductIds) {
        const prodP = prodProductsMap.get(id);
        const localP = localProductsMap.get(id);

        let name = '';
        let category = '';
        let prodPrice = null, localPrice = null;
        let prodCost = null, localCost = null;
        let status = '';
        let isDiff = false;

        if (prodP && localP) {
            name = prodP.name || `${prodP.brand || ''} ${prodP.model || ''}`.trim() || 'Sin Nombre';
            category = prodP.category;
            prodPrice = prodP.price;
            localPrice = localP.price;
            prodCost = prodP.cost;
            localCost = localP.cost;
            isDiff = prodPrice !== localPrice || prodCost !== localCost;
            status = isDiff ? 'Diferente' : 'Idéntico';
            if (isDiff) productsDiffCount++;
        } else if (prodP) {
            name = prodP.name || `${prodP.brand || ''} ${prodP.model || ''}`.trim() || 'Sin Nombre';
            category = prodP.category;
            prodPrice = prodP.price;
            prodCost = prodP.cost;
            status = 'Solo en Producción';
            isDiff = true;
            onlyProdProductsCount++;
        } else {
            name = localP.name || `${localP.brand || ''} ${localP.model || ''}`.trim() || 'Sin Nombre';
            category = localP.category;
            localPrice = localP.price;
            localCost = localP.cost;
            status = 'Solo en Local';
            isDiff = true;
            onlyLocalProductsCount++;
        }

        productsTable.push({
            id,
            name,
            category,
            prodPrice,
            localPrice,
            prodCost,
            localCost,
            status,
            isDiff
        });
    }

    // Generate Markdown
    let md = `# Reporte Comparativo de Precios: Producción vs. Local\n\n`;
    md += `Este reporte analiza las diferencias de precios y productos guardados entre la base de datos de **Producción** (Railway) y el entorno **Local**.\n\n`;

    md += `> [!NOTE]\n`;
    md += `> **Base de Datos Producción**: \`${PROD_URL.split('@')[1]}\`\n`;
    md += `> **Base de Datos Local**: \`localhost / atelier\`\n\n`;

    md += `## Resumen Ejecutivo\n\n`;
    md += `| Módulo | Registros en Prod | Registros en Local | Registros con Diferencias / Desalineados |\n`;
    md += `| --- | --- | --- | --- |\n`;
    md += `| **Precios de Servicio (ServicePricing)** | ${prodServices.length} | ${localServices.length} | ${servicesDiffCount} |\n`;
    md += `| **Productos (Product)** | ${prodProducts.length} | ${localProducts.length} | ${productsDiffCount + onlyProdProductsCount + onlyLocalProductsCount} |\n\n`;

    md += `---\n\n`;
    md += `## 1. Comparación de Precios de Servicio (ServicePricing)\n`;
    md += `Estos precios son los utilizados principalmente por el bot de WhatsApp para cotizaciones automáticas.\n\n`;

    // Separate services by status
    const diffServices = servicesTable.filter(s => s.isDiff);
    const sameServices = servicesTable.filter(s => !s.isDiff);

    if (diffServices.length > 0) {
        md += `### ⚠️ Servicios con Diferencias o Desalineados (${diffServices.length})\n\n`;
        md += `| Nombre del Servicio | Categoría | Estado | Prod Efectivo | Local Efectivo | Prod Crédito | Local Crédito |\n`;
        md += `| --- | --- | --- | --- | --- | --- | --- |\n`;
        for (const s of diffServices) {
            md += `| ${s.name} | ${s.category} | **${s.status}** | ${formatCurrency(s.prodCash)} | ${formatCurrency(s.localCash)} | ${formatCurrency(s.prodCredit)} | ${formatCurrency(s.localCredit)} |\n`;
        }
        md += `\n`;
    } else {
        md += `### ✅ Todos los precios de servicio están perfectamente sincronizados.\n\n`;
    }

    if (sameServices.length > 0) {
        md += `<details>\n<summary><b>Ver servicios idénticos (${sameServices.length})</b></summary>\n\n`;
        md += `| Nombre del Servicio | Categoría | Efectivo | Crédito |\n`;
        md += `| --- | --- | --- | --- |\n`;
        for (const s of sameServices) {
            md += `| ${s.name} | ${s.category} | ${formatCurrency(s.prodCash)} | ${formatCurrency(s.prodCredit)} |\n`;
        }
        md += `\n</details>\n\n`;
    }

    md += `---\n\n`;
    md += `## 2. Comparación de Catálogo de Productos (Product)\n`;
    md += `Estos son los productos y cristales cargados en el CRM.\n\n`;

    const onlyProd = productsTable.filter(p => p.status === 'Solo en Producción');
    const onlyLocal = productsTable.filter(p => p.status === 'Solo en Local');
    const diffProducts = productsTable.filter(p => p.status === 'Diferente');
    const sameProducts = productsTable.filter(p => p.status === 'Idéntico');

    md += `### Resumen de Diferencias de Catálogo:\n`;
    md += `- **Solo en Producción**: ${onlyProd.length} productos\n`;
    md += `- **Solo en Local**: ${onlyLocal.length} productos\n`;
    md += `- **Con precios o costos diferentes**: ${diffProducts.length} productos\n`;
    md += `- **Perfectamente sincronizados**: ${sameProducts.length} productos\n\n`;

    if (diffProducts.length > 0) {
        md += `### ⚠️ Productos con Precios o Costos Diferentes (${diffProducts.length})\n\n`;
        md += `| ID / Nombre | Categoría | Precio Prod | Precio Local | Costo Prod | Costo Local |\n`;
        md += `| --- | --- | --- | --- | --- | --- |\n`;
        for (const p of diffProducts) {
            md += `| \`${p.id}\`<br>${p.name} | ${p.category} | ${formatCurrency(p.prodPrice)} | ${formatCurrency(p.localPrice)} | ${formatCurrency(p.prodCost)} | ${formatCurrency(p.localCost)} |\n`;
        }
        md += `\n`;
    }

    if (onlyLocal.length > 0) {
        md += `### 🆕 Productos Existentes Solo en Local (${onlyLocal.length})\n`;
        md += `Estos productos se crearon localmente y no están subidos a producción.\n\n`;
        md += `| ID / Nombre | Categoría | Precio Local | Costo Local |\n`;
        md += `| --- | --- | --- | --- |\n`;
        for (const p of onlyLocal) {
            md += `| \`${p.id}\`<br>${p.name} | ${p.category} | ${formatCurrency(p.localPrice)} | ${formatCurrency(p.localCost)} |\n`;
        }
        md += `\n`;
    }

    if (onlyProd.length > 0) {
        md += `### 🟥 Productos Existentes Solo en Producción (${onlyProd.length})\n`;
        md += `Estos productos están en la base de producción pero no en tu base local.\n\n`;
        md += `| ID / Nombre | Categoría | Precio Prod | Costo Prod |\n`;
        md += `| --- | --- | --- | --- |\n`;
        for (const p of onlyProd) {
            md += `| \`${p.id}\`<br>${p.name} | ${p.category} | ${formatCurrency(p.prodPrice)} | ${formatCurrency(p.prodCost)} |\n`;
        }
        md += `\n`;
    }

    if (sameProducts.length > 0) {
        md += `<details>\n<summary><b>Ver productos idénticos (${sameProducts.length})</b></summary>\n\n`;
        md += `| ID / Nombre | Categoría | Precio | Costo |\n`;
        md += `| --- | --- | --- | --- |\n`;
        for (const p of sameProducts) {
            md += `| \`${p.id}\`<br>${p.name} | ${p.category} | ${formatCurrency(p.prodPrice)} | ${formatCurrency(p.prodCost)} |\n`;
        }
        md += `\n</details>\n`;
    }

    fs.writeFileSync(REPORT_PATH, md);
    console.log(`Report written to ${REPORT_PATH}`);

    await local.$disconnect();
    await prod.$disconnect();
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
