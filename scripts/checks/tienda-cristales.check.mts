/**
 * ¿Qué producto está vendiendo cada opción de cristal de la tienda? SOLO LEE.
 *
 * La tienda puede "andar" con precios equivocados: si una opción no encuentra su
 * producto, cae a un precio de respaldo fijo y nadie se entera. Pasó del 8/9 al
 * 11/9/2026. Este control muestra, opción por opción, qué producto resuelve, a
 * qué precio y CÓMO lo encontró:
 *   id             → configurado en web_cristales_opciones (lo sano)
 *   palabra-clave  → por nombre en CrystalMapping (frágil: un rename lo rompe)
 *   RESPALDO       → no encontró nada: la web muestra un número fijo
 *
 *   npm run check:tienda -- --produccion
 *   npm run check:tienda -- --produccion --simular   # con los ids de opciones-cristales-web.json
 */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { cargarCatalogoWeb, resolverOpcionWeb, findTintPrice } from '@/lib/checkout/checkout-pricing';

config();
const PRODUCCION = process.argv.includes('--produccion');
const SIMULAR = process.argv.includes('--simular');
const OFRECIDAS: ['MONOFOCAL' | 'BIFOCAL' | 'MULTIFOCAL', string][] = [
    ['MONOFOCAL', 'ORGANICO_BLANCO'], ['MONOFOCAL', 'ORGANICO_AR'], ['MONOFOCAL', 'ORGANICO_BLUE'],
    ['MONOFOCAL', 'POLI_BLUE'], ['MONOFOCAL', 'ORGANICO_FOTOCROMATICO'], ['BIFOCAL', 'ORGANICO_BLANCO'],
    ['MULTIFOCAL', 'SMART_FREE'], ['MULTIFOCAL', 'VARILUX'], ['MULTIFOCAL', 'FOTOCROMATICO'],
];
const f = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`;

const prisma = new PrismaClient({ datasources: { db: { url: PRODUCCION ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL } } });
try {
    const { crystals, treatments } = await cargarCatalogoWeb(prisma);
    let opciones: Record<string, string> = {};
    if (SIMULAR) {
        const d = JSON.parse(readFileSync('scripts/maintenance/tienda/opciones-cristales-web.json', 'utf8'));
        for (const [k, o] of Object.entries<any>(d.opciones)) if (o.id) opciones[k] = o.id;
    } else {
        const [s] = await prisma.$queryRaw<any[]>`select value from "SystemSetting" where key = 'web_cristales_opciones'`;
        if (s) opciones = JSON.parse(s.value);
    }
    console.log(`Base: ${PRODUCCION ? 'PRODUCCIÓN' : 'LOCAL'} · ${SIMULAR ? 'SIMULANDO los ids del JSON' : `web_cristales_opciones: ${Object.keys(opciones).length} cargadas`}\n`);
    let frágiles = 0;
    for (const [g, o] of OFRECIDAS) {
        const r = resolverOpcionWeb(crystals, g, o, opciones);
        const marca = r.via === 'id' ? '✓ id          ' : r.via === 'palabra-clave' ? '⚠ palabra-clave' : '❌ RESPALDO    ';
        if (r.via !== 'id') frágiles++;
        console.log(`  ${marca}  ${`${g}.${o}`.padEnd(34)} ${r.producto ? `${f(r.producto.price).padStart(11)}  ${r.producto.name}` : '(precio fijo de respaldo)'}`);
    }
    console.log(`  ✓ teñido          EXTRAS.TINT                        ${f(findTintPrice(treatments)).padStart(11)}`);
    console.log(`\n${frágiles ? `${frágiles} opción(es) sin id: dependen del nombre del producto o muestran un precio fijo.` : 'Todas las opciones apuntan a un producto por id.'}`);
    if (frágiles) process.exitCode = 1;
} finally { await prisma.$disconnect(); }
