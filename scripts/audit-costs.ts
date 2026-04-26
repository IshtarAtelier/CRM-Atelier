import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const CALIBRADO = 40000;
const IVA = 1.21;

async function main() {
    const products = await prisma.product.findMany({
        where: {
            OR: [
                { category: 'CRISTAL' },
                { type: { contains: 'Cristal' } },
                { type: { contains: 'Multifocal' } },
                { type: { contains: 'Monofocal' } },
            ]
        },
        select: { id: true, brand: true, name: true, type: true, category: true, cost: true, price: true, is2x1: true, laboratory: true },
        orderBy: [{ brand: 'asc' }, { name: 'asc' }]
    });

    // Group by brand
    const grouped: Record<string, typeof products> = {};
    for (const p of products) {
        const brand = p.brand || '—';
        if (!grouped[brand]) grouped[brand] = [];
        grouped[brand].push(p);
    }

    const lines: string[] = [];
    lines.push('# Auditoría de Costos — Cristales');
    lines.push('');
    lines.push('**Fórmula:** Costo Real = Lista × 1.21 (IVA) + $40.000 (calibrado)');
    lines.push('**Precio mínimo:** Costo Real × 2.4');
    lines.push('');

    let problemCount = 0;
    let noCostCount = 0;

    for (const [brand, prods] of Object.entries(grouped)) {
        lines.push(`## ${brand.toUpperCase()}`);
        lines.push('');
        lines.push('| Producto | Lista (costo DB) | Costo Real | Precio Venta | Mín ×2.4 | Markup | Estado |');
        lines.push('|---|---|---|---|---|---|---|');

        for (const p of prods) {
            const lista = p.cost || 0;
            const costoReal = lista > 0 ? Math.round(lista * IVA + CALIBRADO) : 0;
            const precioActual = p.price || 0;
            const precioMin = costoReal > 0 ? Math.round(costoReal * 2.4) : 0;

            let status = '✅';
            if (lista === 0) { status = '⚪ Sin costo'; noCostCount++; }
            else if (precioActual < costoReal) { status = '🔴 PÉRDIDA'; problemCount++; }
            else if (precioActual < precioMin) { status = '🟡 BAJO'; problemCount++; }

            const markup = costoReal > 0 ? ((precioActual / costoReal - 1) * 100).toFixed(0) + '%' : '—';
            const name = (p.name || '—').substring(0, 60) + (p.is2x1 ? ' [2x1]' : '');

            lines.push(`| ${name} | $${lista.toLocaleString()} | $${costoReal.toLocaleString()} | $${precioActual.toLocaleString()} | $${precioMin.toLocaleString()} | ${markup} | ${status} |`);
        }
        lines.push('');
    }

    lines.push(`---`);
    lines.push(`**Total cristales:** ${products.length}`);
    lines.push(`**Con problemas de markup:** ${problemCount}`);
    lines.push(`**Sin costo cargado:** ${noCostCount}`);

    // Write to file
    const fs = await import('fs');
    const outPath = 'scripts/audit-costs-report.md';
    fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
    console.log(`Reporte escrito en: ${outPath}`);
    console.log(`Total: ${products.length} | Problemas: ${problemCount} | Sin costo: ${noCostCount}`);

    await prisma.$disconnect();
}

main();
