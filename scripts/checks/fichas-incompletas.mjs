#!/usr/bin/env node
/**
 * Qué fichas de la tienda están incompletas: fotos y medidas.  SOLO LEE.
 *
 *   node scripts/checks/fichas-incompletas.mjs            → base del .env
 *   node scripts/checks/fichas-incompletas.mjs --prod     → producción (solo lectura)
 *   node scripts/checks/fichas-incompletas.mjs --prod --csv > faltantes.csv
 *
 * Nace de la auditoría de catálogo del 15/10/2026 (plan de tienda, tareas
 * 1.6 y 6.1): la ficha de receta que más se agregaba al carrito decía
 * "todavía no tenemos cargadas las medidas", 37 de 66 solares tenían UNA sola
 * foto y ningún clip-on mostraba el clip puesto. Nadie lo sabía porque no
 * había dónde mirarlo: este script es ese lugar. Es la lista de trabajo para
 * la sesión de fotos y para cargar medidas en /admin, y la forma de saber
 * cuándo quedó en cero.
 *
 * "Sin foto en rostro" se estima por el nombre del archivo (agostina, look,
 * puesto, rostro, modelo): es una aproximación, no una verdad. Lo que es
 * exacto es la cantidad de fotos y las medidas (calibre, puente, patilla).
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

const usarProd = process.argv.includes('--prod');
const csv = process.argv.includes('--csv');

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
if (!csv) console.log(`Base: ${usarProd ? 'PRODUCCIÓN (solo lectura)' : 'la del .env'}\n`);

const prisma = new PrismaClient({ datasourceUrl: url });
const EN_ROSTRO = /agostina|look|puest|rostro|modelo|cara|wear/i;

try {
    const fichas = await prisma.webProduct.findMany({
        where: { isActive: true, product: { publishToWeb: true } },
        select: {
            slug: true, name: true, category: true, images: true,
            product: { select: { stock: true, lensWidth: true, bridgeWidth: true, templeLength: true, imagenesCatalogo: true, rawImageUrls: true } },
        },
        orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    const filas = fichas.map((f) => {
        const fotos = f.images?.length ? f.images : (f.product.imagenesCatalogo?.length ? f.product.imagenesCatalogo : f.product.rawImageUrls || []);
        const enRostro = fotos.some((u) => EN_ROSTRO.test(u));
        const sinMedidas = !(f.product.lensWidth && f.product.bridgeWidth && f.product.templeLength);
        return {
            categoria: f.category, nombre: f.name, slug: f.slug, stock: f.product.stock,
            fotos: fotos.length, enRostro, sinMedidas,
        };
    });

    const problemas = filas.filter((r) => r.fotos === 0 || r.fotos === 1 || !r.enRostro || r.sinMedidas);

    if (csv) {
        console.log('categoria,nombre,slug,stock,fotos,en_rostro,sin_medidas');
        for (const r of problemas) console.log([r.categoria, JSON.stringify(r.nombre), r.slug, r.stock, r.fotos, r.enRostro ? 'si' : 'no', r.sinMedidas ? 'si' : 'no'].join(','));
    } else {
        const porCat = {};
        for (const r of filas) {
            const c = (porCat[r.categoria] ||= { total: 0, sinFoto: 0, unaFoto: 0, sinRostro: 0, sinMedidas: 0 });
            c.total++;
            if (r.fotos === 0) c.sinFoto++;
            if (r.fotos === 1) c.unaFoto++;
            if (!r.enRostro) c.sinRostro++;
            if (r.sinMedidas) c.sinMedidas++;
        }
        console.log('Categoría   fichas  sin foto  1 foto  sin rostro*  sin medidas');
        for (const [cat, c] of Object.entries(porCat)) {
            console.log(`${cat.padEnd(11)} ${String(c.total).padStart(6)}  ${String(c.sinFoto).padStart(8)}  ${String(c.unaFoto).padStart(6)}  ${String(c.sinRostro).padStart(11)}  ${String(c.sinMedidas).padStart(11)}`);
        }
        console.log('\n* estimado por el nombre del archivo.\n');
        console.log(`Fichas con algo que falta: ${problemas.length} de ${filas.length}.`);
        console.log('Lista completa con --csv. Las medidas se cargan en /admin (calibre, puente, patilla).');
        const peor = problemas.filter((r) => r.sinMedidas && r.fotos <= 1).slice(0, 15);
        if (peor.length) {
            console.log('\nLas 15 más urgentes (una foto o ninguna Y sin medidas):');
            for (const r of peor) console.log(`  ${r.categoria.padEnd(8)} ${r.nombre}  (${r.fotos} foto${r.fotos === 1 ? '' : 's'}, stock ${r.stock})  /producto/${r.slug}`);
        }
    }
    process.exit(problemas.length ? 1 : 0);
} finally {
    await prisma.$disconnect();
}
