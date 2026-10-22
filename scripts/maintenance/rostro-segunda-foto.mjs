#!/usr/bin/env node
/**
 * ⚠️ ESCRIBE en la base (con --aplicar): en cada ficha web, la SEGUNDA foto pasa
 *   a ser la primera foto con rostro (la persona con el anteojo puesto).
 *
 * Por qué (Ishtar, 16/10/2026: "que en la segunda imagen siempre muestre un
 * rostro"): la grilla de la tienda muestra images[1] al pasar el mouse (y en el
 * celular cuando la tarjeta cruza el centro, ver useFocoMovil). En 28 fichas esa
 * segunda foto era otra del anteojo solo (de costado, de atrás) y la foto con la
 * modelo quedaba más adelante en la galería. La primera foto (images[0], la del
 * armazón solo) NO se toca: es la de la grilla, WhatsApp y el feed de Google.
 *
 * Qué cuenta como rostro: las fotos de sesión, `-look-<n>` (Agos) y
 * `-<sesión>-<n>` (Massaru). Una ficha sin ninguna no se toca: hay que
 * fotografiar ese armazón.
 *
 * Reversible: el AuditLog guarda el orden anterior de cada ficha.
 *
 * Uso:
 *   node --env-file=.env scripts/maintenance/rostro-segunda-foto.mjs                          (simula, base local)
 *   node --env-file=.env scripts/maintenance/rostro-segunda-foto.mjs --produccion             (simula contra prod)
 *   node --env-file=.env scripts/maintenance/rostro-segunda-foto.mjs --produccion --aplicar   (con OK de Ishtar)
 */
import { PrismaClient } from '@prisma/client';

const APLICAR = process.argv.includes('--aplicar');
const PRODUCCION = process.argv.includes('--produccion');
if (PRODUCCION && !process.env.PROD_DATABASE_URL) { console.error('Falta PROD_DATABASE_URL.'); process.exit(2); }
const prisma = new PrismaClient(PRODUCCION ? { datasources: { db: { url: process.env.PROD_DATABASE_URL } } } : {});

export const ES_ROSTRO = /-(look|massaru)-\d+\.webp(\?|$)/;

/** El nuevo orden: images[0] queda; la primera foto con rostro pasa a la posición 1. */
export function conRostroSegundo(images, alts) {
    if (images.length < 2 || ES_ROSTRO.test(images[1])) return null;
    const i = images.findIndex((u, k) => k > 1 && ES_ROSTRO.test(u));
    if (i < 0) return null;
    const mover = (arr) => { const a = [...arr]; const [x] = a.splice(i, 1); a.splice(1, 0, x); return a; };
    const altsAlineados = alts.length ? [...alts, ...Array(Math.max(0, images.length - alts.length)).fill('')] : [];
    return { images: mover(images), imageAlts: altsAlineados.length ? mover(altsAlineados) : [] };
}

async function main() {
    console.log(`Base: ${PRODUCCION ? '⚠️  PRODUCCIÓN' : 'local'} · modo: ${APLICAR ? '⚠️  APLICAR' : 'simulación'}\n`);
    const fichas = await prisma.webProduct.findMany({
        where: { isActive: true },
        select: { id: true, slug: true, images: true, imageAlts: true },
        orderBy: { slug: 'asc' },
    });
    const cambios = [];
    let sinRostro = 0;
    for (const f of fichas) {
        if (!f.images.some((u) => ES_ROSTRO.test(u))) { sinRostro++; continue; }
        const nuevo = conRostroSegundo(f.images, f.imageAlts);
        if (nuevo) cambios.push({ f, nuevo });
    }
    for (const { f, nuevo } of cambios) {
        const corto = (u) => u.split('/').pop().split('?')[0];
        console.log(`  ${f.slug.padEnd(48)} 2ª: ${corto(f.images[1]).padEnd(34)} → ${corto(nuevo.images[1])}`);
    }
    console.log(`\nFichas a reordenar: ${cambios.length} · ya con rostro en la 2ª: ${fichas.length - cambios.length - sinRostro} · sin ninguna foto con rostro: ${sinRostro}`);
    if (!APLICAR) { console.log('\nSIMULACIÓN — no se escribió nada.'); return; }

    for (const { f, nuevo } of cambios) {
        await prisma.webProduct.update({ where: { id: f.id }, data: nuevo, select: { id: true } });
    }
    await prisma.auditLog.create({
        data: {
            userId: null, userName: 'Claude (pedido de Ishtar)', action: 'UPDATE', entityType: 'WEB_PRODUCT', entityId: 'rostro-segunda-foto',
            details: { cambio: 'La 2ª foto de la galería pasa a ser la primera con rostro', fichas: cambios.length, ordenAnterior: cambios.map(({ f }) => ({ slug: f.slug, images: f.images, imageAlts: f.imageAlts })) },
        },
        select: { id: true },
    });
    console.log(`\nEscritas: ${cambios.length} fichas (orden anterior guardado en AuditLog 'rostro-segunda-foto').`);
}

main().catch((e) => { console.error('Falló:', e); process.exit(1); }).finally(() => prisma.$disconnect());
