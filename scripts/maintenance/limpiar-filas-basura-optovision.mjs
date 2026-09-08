/**
 * Borra las filas BASURA de Optovisión: entradas que representan una factura que
 * YA está asignada a su pedido real, y que quedaron duplicadas por dos caminos.
 *
 *  a) La clave literal "S/PEDIDO 3008-000XXXXX", que el escaneo IMAP volvía a
 *     crear cada vez que releía un PDF ya asignado a mano.
 *  b) Claves numéricas sacadas de adentro de esa clave literal ("00075115"),
 *     que aparecieron el 8/9/2026 cuando `upsertEntry` pasó a exigir 5 dígitos
 *     y algún camino le pasó la clave literal sin marcarla como tal.
 *
 * Las DOS causas ya están arregladas en el código; esto limpia lo que quedó.
 *
 * SEGURIDAD: solo borra una fila si (1) no tiene venta asignada y (2) existe
 * otra fila de la MISMA factura que sí la tiene. Si no se cumplen las dos, no
 * toca nada — una factura nunca puede desaparecer de la auditoría.
 *
 * ESCRIBE EN PRODUCCIÓN. Por defecto solo muestra qué haría:
 *   node scripts/maintenance/limpiar-filas-basura-optovision.mjs
 *   node scripts/maintenance/limpiar-filas-basura-optovision.mjs --aplicar
 */

import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const url = process.env.PROD_DATABASE_URL;
if (!url) {
    console.error('Falta PROD_DATABASE_URL en el .env');
    process.exit(1);
}

const prisma = new PrismaClient({ datasources: { db: { url } } });
const APLICAR = process.argv.includes('--aplicar');
const pesos = n => n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`;

/** El nº de comprobante que identifica la factura, sacado del sourceFile. */
const comprobanteDe = (sourceFile) => (String(sourceFile || '').match(/(\d{4})-?(\d{6,})/) || [])[2] || null;

async function main() {
    console.log(APLICAR ? 'APLICANDO CAMBIOS EN PRODUCCIÓN\n' : 'ENSAYO — no se escribe nada. Para aplicar: --aplicar\n');

    const todas = await prisma.labCostEntry.findMany({
        where: { lab: 'OPTOVISION' },
        select: { id: true, labOrderNumber: true, sourceFile: true, orderId: true, status: true, billedTotal: true, billedNet: true },
    });

    // Agrupar por factura para saber cuál fila es la buena.
    const porFactura = new Map();
    for (const e of todas) {
        const nro = comprobanteDe(e.sourceFile);
        if (!nro) continue;
        if (!porFactura.has(nro)) porFactura.set(nro, []);
        porFactura.get(nro).push(e);
    }

    const borrables = [];
    for (const [nro, filas] of porFactura) {
        const buena = filas.find(f => f.orderId);
        if (!buena) continue; // nadie la asignó todavía: no se toca ninguna
        for (const f of filas) {
            if (f.orderId) continue;                       // la buena, y cualquier otra con venta
            // Solo las claves que NO son un nº de pedido de verdad: la literal
            // "S/PEDIDO …" y las derivadas con ceros a la izquierda.
            const esBasura = f.labOrderNumber.startsWith('S/PEDIDO') || /^0\d+$/.test(f.labOrderNumber);
            if (!esBasura) continue;
            borrables.push({ ...f, nro, buena });
        }
    }

    if (borrables.length === 0) {
        console.log('No hay filas basura para borrar.');
        return;
    }

    for (const b of borrables) {
        console.log(`factura ${b.nro}`);
        console.log(`   BORRAR:    "${b.labOrderNumber}" · ${pesos(b.billedTotal ?? b.billedNet)} · ${b.status} · sin venta`);
        console.log(`   se queda:  "${b.buena.labOrderNumber}" · ${pesos(b.buena.billedTotal ?? b.buena.billedNet)} · ${b.buena.status} · CON venta`);
        console.log();
    }
    console.log(`RESUMEN: ${borrables.length} fila(s) basura a borrar\n`);
    if (!APLICAR) { console.log('Ensayo terminado. Nada se escribió.'); return; }

    for (const b of borrables) {
        await prisma.$executeRaw`delete from "LabCostEntry" where id = ${b.id}`;
        console.log(`  borrada "${b.labOrderNumber}" (la factura ${b.nro} ya está en "${b.buena.labOrderNumber}")`);
    }
    console.log('\nListo.');
}

main()
    .catch(err => { console.error(err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
