// ────────────────────────────────────────────────────────────────────────────
// PRUEBA EN VIVO DE LA CARGA ASISTIDA DE OPTOVISIÓN, SOLO LECTURA EN LOS
// PORTALES: analiza una venta, prepara un par (el robot entra a OVES y a la
// web de la promo en solo lectura, llena el formulario, saca la captura) y
// muestra lo que quedó en el borrador. NO aprueba: nada se graba en OVES ni se
// genera cupón.
//
//   DATABASE_URL=<base LOCAL> node --experimental-strip-types --import ./scripts/checks/_alias.mjs --env-file=.env \
//     scripts/checks/optovision-preparar-vivo.mjs <orderId> <par> [clave=valor ...]
//
// Ej.: … cmtt6rafo000710s7dbe06ejq 1 tratamiento=CRIZAL_FORTE_UV calibrado=COMUN tipoArmazon=2 genero=M
// Escribe en LabOrderDraft de la base que diga DATABASE_URL: apuntarla a una copia local, nunca a producción.
// ────────────────────────────────────────────────────────────────────────────
import { CARGA_OPTOVISION } from '../../src/services/lab-modules/optovision/carga-asistida.ts';
import { prisma } from '../../src/lib/db.ts';

const [orderId, parTxt, ...resto] = process.argv.slice(2);
if (!orderId || !parTxt) { console.error('uso: <orderId> <par> [clave=valor ...]'); process.exit(2); }
if (!/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '')) { console.error('DATABASE_URL tiene que ser una base LOCAL.'); process.exit(2); }
const par = Number(parTxt);
const body = Object.fromEntries(resto.map(kv => kv.split('=')));
const actor = { id: null, name: 'Prueba en vivo', role: 'ADMIN' };
const j = (v) => JSON.stringify(v, null, 1);

const analisis = await CARGA_OPTOVISION.analizar(orderId);
console.log('ANÁLISIS:', j(analisis?.pares.map(p => ({ par: p.pair, titulo: p.titulo, rol: p.rol?.etiqueta, faltantes: p.faltantes, avisos: p.avisos, aMano: p.aMano, espera: p.espera, yaCargado: p.yaCargado, campos: p.campos.map(c => `${c.clave}${c.obligatorio ? '*' : ''}`) }))));
if (body.soloAnalizar) { await prisma.$disconnect(); process.exit(0); }

const r = await CARGA_OPTOVISION.preparar(orderId, par, body, actor);
console.log('PREPARAR:', j({ ok: r.ok, status: r.status, error: r.error, faltantes: r.faltantes, avisos: r.avisos, borradorId: r.borrador?.id }));
if (!r.ok) { await prisma.$disconnect(); process.exit(1); }

const id = r.borrador.id;
const t0 = Date.now();
for (;;) {
    await new Promise(res => setTimeout(res, 5000));
    const b = await prisma.labOrderDraft.findUnique({ where: { id } });
    const etapa = b?.resumenPortal?.etapa;
    process.stdout.write(`\r${Math.round((Date.now() - t0) / 1000)} s · ${b?.status} · ${etapa || ''}          `);
    if (b && b.status !== 'PREPARADO') {
        console.log('\nBORRADOR:', j({ status: b.status, error: b.error, screenshotUrl: b.screenshotUrl }));
        const rp = b.resumenPortal || {};
        console.log('RASTRO:', j({ formulario: rp.formulario, noAplican: rp.noAplican, cuponResuelto: rp.cuponResuelto, cuponWeb: rp.cuponWeb, cuponAvisos: rp.cuponAvisos, cuponPedido: rp.cuponPedido && { ...rp.cuponPedido, cliente: { ...rp.cuponPedido.cliente, dni: '…' } } }));
        console.log('VISTA:', j(CARGA_OPTOVISION.vistaDeBorrador({ status: b.status, pair: b.pair, payload: b.payload, resumenPortal: b.resumenPortal, screenshotUrl: b.screenshotUrl, screenshotFinalUrl: b.screenshotFinalUrl, portalNumber: b.portalNumber, error: b.error })));
        break;
    }
    if (Date.now() - t0 > 40 * 60_000) { console.log('\nsin resultado en 40 min'); break; }
}
await prisma.$disconnect();
