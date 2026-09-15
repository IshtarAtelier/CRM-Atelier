/**
 * Modelos ACTIVOS EN LA TIENDA ONLINE que además se VENDIERON.
 *
 * "Activo en la tienda" = exactamente lo que ve un visitante en /tienda
 * (src/lib/catalog/queries.ts → tiendaCatalogo): WebProduct.isActive +
 * product.publishToWeb + stock > 0 + categoría distinta de Cristal.
 * "Vendido" = tiene líneas en órdenes con orderType 'SALE' y no borradas.
 *
 * SOLO LECTURA. No escribe una sola fila.
 *
 * Uso:
 *   node scripts/checks/modelos-vendidos-en-tienda.mjs            (base local)
 *   node scripts/checks/modelos-vendidos-en-tienda.mjs --prod     (producción, solo lee)
 *   ... --json <archivo>   vuelca el resultado para armar el mail/planilla
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync } from 'node:fs';

const usarProd = process.argv.includes('--prod');
const idxJson = process.argv.indexOf('--json');
const salidaJson = idxJson !== -1 ? process.argv[idxJson + 1] : null;

// El .env no se parsea con dotenv a propósito: solo se saca la URL que hace
// falta y nunca se imprime.
const env = Object.fromEntries(
    readFileSync(new URL('../../.env', import.meta.url), 'utf8')
        .split('\n')
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]),
);

const url = usarProd ? env.PROD_DATABASE_URL : env.DATABASE_URL;
if (!url) {
    console.error(`No encontré ${usarProd ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en .env`);
    process.exit(1);
}
console.log(`Base: ${usarProd ? 'PRODUCCIÓN' : 'local'} (${url.replace(/:\/\/[^@]*@/, '://***@').split('?')[0]})\n`);

const prisma = new PrismaClient({ datasourceUrl: url });

const fmtFecha = (d) => (d ? new Date(d).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' }) : '—');
const fmtPlata = (n) => '$' + Math.round(n).toLocaleString('es-AR');

try {
    // 1) Lo que hoy se ve en /tienda. `select` explícito: contra producción el
    //    schema local está adelantado y devolver la fila entera revienta.
    const activos = await prisma.webProduct.findMany({
        where: {
            isActive: true,
            product: { publishToWeb: true, stock: { gt: 0 }, category: { not: 'Cristal' } },
        },
        select: {
            name: true,
            slug: true,
            category: true,
            isFeatured: true,
            product: { select: { id: true, brand: true, model: true, name: true, stock: true, price: true, salePrice: true, category: true } },
        },
    });

    const porProducto = new Map(activos.map((w) => [w.product.id, w]));
    const ids = [...porProducto.keys()];
    console.log(`Activos en la tienda hoy: ${ids.length} modelos\n`);

    // 2) Sus ventas (cualquier canal: mostrador y web).
    const items = await prisma.orderItem.findMany({
        where: {
            productId: { in: ids },
            order: { orderType: 'SALE', isDeleted: false },
        },
        select: {
            productId: true,
            quantity: true,
            price: true,
            order: {
                select: {
                    id: true,
                    createdAt: true,
                    paymentIntents: { select: { id: true }, take: 1 },
                },
            },
        },
    });

    const acum = new Map();
    for (const it of items) {
        const a = acum.get(it.productId) ?? { unidades: 0, facturado: 0, ordenes: new Set(), ordenesWeb: new Set(), primera: null, ultima: null };
        a.unidades += it.quantity || 1;
        a.facturado += (it.price || 0) * (it.quantity || 1);
        a.ordenes.add(it.order.id);
        if (it.order.paymentIntents.length > 0) a.ordenesWeb.add(it.order.id);
        const f = it.order.createdAt;
        if (!a.primera || f < a.primera) a.primera = f;
        if (!a.ultima || f > a.ultima) a.ultima = f;
        acum.set(it.productId, a);
    }

    const vendidos = [...acum.entries()]
        .map(([id, a]) => {
            const w = porProducto.get(id);
            return {
                marca: w.product.brand || '—',
                modelo: w.product.model || w.product.name || w.name,
                nombreTienda: w.name,
                slug: w.slug,
                categoria: w.category || w.product.category,
                destacado: w.isFeatured,
                stock: w.product.stock,
                precio: w.product.salePrice && w.product.salePrice > 0 && w.product.salePrice < w.product.price ? w.product.salePrice : w.product.price,
                unidades: a.unidades,
                ventas: a.ordenes.size,
                ventasWeb: a.ordenesWeb.size,
                facturado: a.facturado,
                primera: a.primera,
                ultima: a.ultima,
            };
        })
        .sort((a, b) => b.unidades - a.unidades || b.facturado - a.facturado);

    const sinVender = activos
        .filter((w) => !acum.has(w.product.id))
        .map((w) => ({
            marca: w.product.brand || '—',
            modelo: w.product.model || w.product.name || w.name,
            nombreTienda: w.name,
            categoria: w.category || w.product.category,
            stock: w.product.stock,
            precio: w.product.salePrice && w.product.salePrice > 0 && w.product.salePrice < w.product.price ? w.product.salePrice : w.product.price,
        }))
        .sort((a, b) => (a.marca + a.modelo).localeCompare(b.marca + b.modelo));

    const totUnidades = vendidos.reduce((s, v) => s + v.unidades, 0);
    const totFacturado = vendidos.reduce((s, v) => s + v.facturado, 0);
    const totWeb = vendidos.reduce((s, v) => s + v.ventasWeb, 0);

    console.log(`Con ventas: ${vendidos.length} modelos — ${totUnidades} unidades — ${fmtPlata(totFacturado)} (${totWeb} de esas ventas entraron por la tienda web)`);
    console.log(`Sin ninguna venta: ${sinVender.length} modelos\n`);

    // El nombre de la TIENDA va primero: es el que la óptica reconoce (estelar
    // + color). El código de fábrica queda al lado para cruzar con el lab.
    console.log('MODELO (TIENDA)'.padEnd(24) + 'CÓDIGO'.padEnd(28) + 'U.'.padStart(4) + 'WEB'.padStart(5) + 'FACTURADO'.padStart(14) + '  ÚLTIMA');
    console.log('─'.repeat(90));
    for (const v of vendidos) {
        console.log(
            String(v.nombreTienda).slice(0, 23).padEnd(24) +
            String(v.modelo).slice(0, 27).padEnd(28) +
            String(v.unidades).padStart(4) +
            String(v.ventasWeb || '').padStart(5) +
            fmtPlata(v.facturado).padStart(14) +
            '  ' + fmtFecha(v.ultima),
        );
    }

    if (salidaJson) {
        writeFileSync(salidaJson, JSON.stringify({
            base: usarProd ? 'produccion' : 'local',
            generado: new Date().toISOString(),
            activos: ids.length,
            totales: { modelosConVenta: vendidos.length, unidades: totUnidades, facturado: totFacturado, ventasWeb: totWeb },
            vendidos,
            sinVender,
        }, null, 2));
        console.log(`\nJSON: ${salidaJson}`);
    }
} finally {
    await prisma.$disconnect();
}
