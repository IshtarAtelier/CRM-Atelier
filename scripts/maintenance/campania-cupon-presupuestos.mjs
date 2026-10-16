#!/usr/bin/env node
/**
 * Campaña de cupón para los presupuestos abiertos de la tienda.  SOLO LEE
 * (salvo --mail, que manda los mails a quienes tienen dirección).
 *
 *   node --experimental-strip-types --import ./scripts/checks/_alias.mjs \
 *     scripts/maintenance/campania-cupon-presupuestos.mjs --cupon VOLVE10            → base del .env
 *   … --cupon VOLVE10 --prod                                                       → producción, solo lista
 *   … --cupon VOLVE10 --prod --mail                                                 → además MANDA los mails (con OK de Ishtar)
 *   … --cupon VOLVE10 --prod --html salida.html                                     → guarda la vista previa del mail
 *
 * Qué hace: busca a las personas con origen "Tienda online" / "Carrito Web"
 * (sin robots) que recibieron presupuesto en los últimos N días (--dias, 35)
 * y no compraron, y para cada una imprime: teléfono (parcial), qué cotizó,
 * si tiene mail, y el TEXTO exacto para mandarle por WhatsApp. El cupón se
 * lee de la tabla Coupon: si no existe, no está activo o venció, el script se
 * niega. Por qué: lo que se promete tiene que ser canjeable (regla del
 * recupero de carrito, lib/checkout/recovery.ts).
 *
 * WhatsApp NO se manda desde acá: fuera de la ventana de 24 h solo entra una
 * plantilla aprobada por Meta (`presupuesto_cupon`, en borrador hasta que
 * Ishtar la apruebe) o un mensaje escrito por una persona desde su teléfono.
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync } from 'node:fs';
import { asuntoCampaniaCupon, htmlCampaniaCupon, textoWhatsAppCampaniaCupon } from '../../src/lib/email/campania-cupon.ts';
import { formatDate } from '../../src/lib/format-date.ts';
import { precioConSigno } from '../../src/lib/format-precio.ts';
import { listarPresupuestosTiendaAbiertos } from '../../src/lib/checkout/presupuestos-tienda-abiertos.ts';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const usarProd = process.argv.includes('--prod');
const mandarMail = process.argv.includes('--mail');
const codigo = String(arg('cupon', '')).trim().toUpperCase();
const dias = Number(arg('dias', 35));
const htmlOut = arg('html', '');
if (!codigo) { console.error('Falta --cupon CODIGO'); process.exit(1); }

const env = Object.fromEntries(readFileSync(new URL('../../.env', import.meta.url), 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]));
const url = usarProd ? env.PROD_DATABASE_URL : env.DATABASE_URL;
if (!url) { console.error('Sin URL de base en .env'); process.exit(1); }
console.log(`Base: ${usarProd ? 'PRODUCCIÓN' : 'local'} · cupón ${codigo} · últimos ${dias} días${mandarMail ? ' · MANDA MAILS' : ' · solo lista'}\n`);
const prisma = new PrismaClient({ datasourceUrl: url });

try {
    const cupon = await prisma.coupon.findUnique({ where: { code: codigo } });
    if (!cupon || !cupon.isActive) throw new Error(`El cupón ${codigo} no existe o no está activo: crearlo en /admin/web antes.`);
    if (cupon.expiresAt && cupon.expiresAt.getTime() < Date.now()) throw new Error(`El cupón ${codigo} ya venció.`);
    if (cupon.maxUses != null && cupon.usedCount >= cupon.maxUses) throw new Error(`El cupón ${codigo} ya agotó sus usos.`);
    const cuponMail = {
        code: cupon.code,
        label: cupon.discountType === 'PERCENT' ? `${cupon.discountValue}% OFF` : `${precioConSigno(cupon.discountValue)} OFF`,
        venceEl: cupon.expiresAt ? formatDate(cupon.expiresAt) : 'fin de mes',
        minimo: cupon.minOrderAmount ? precioConSigno(cupon.minOrderAmount) : '',
    };

    const abiertos = await listarPresupuestosTiendaAbiertos(prisma, { dias, horasMinimas: 0 });
    console.log(`${abiertos.length} personas con presupuesto abierto y sin compra (robots descartados)\n`);

    let html = '';
    let mails = 0;
    for (const p of abiertos) {
        const params = { nombre: p.nombre, cupon: cuponMail, motivo: 'presupuesto', producto: p.producto, urlTienda: 'https://atelieroptica.com.ar/tienda' };
        console.log(`▸ ${p.nombre}  ·  …${p.telefono.slice(-4)}  ·  presupuesto ${precioConSigno(p.presupuesto)} del ${formatDate(p.fechaPresupuesto)}  ·  mail: ${p.email ? 'sí' : 'no'}`);
        console.log(textoWhatsAppCampaniaCupon(params).split('\n').map((l) => `    ${l}`).join('\n') + '\n');
        if (!html) html = htmlCampaniaCupon(params);
        if (mandarMail && p.email) {
            const { sendClientEmail } = await import('../../src/lib/client-email.ts');
            const ok = await sendClientEmail({ to: p.email, subject: asuntoCampaniaCupon(params), bodyHtml: htmlCampaniaCupon(params), label: `cupón ${codigo}` });
            if (ok) mails++;
        }
    }
    if (htmlOut && html) { writeFileSync(htmlOut, `<!doctype html><meta charset="utf-8"><title>Vista previa</title>${html}`); console.log(`Vista previa del mail: ${htmlOut}`); }
    if (mandarMail) console.log(`\nMails enviados: ${mails}`);
    else console.log('\nNo se mandó nada. --mail manda a quienes tienen dirección; WhatsApp lo manda una persona o la plantilla presupuesto_cupon cuando Meta la apruebe.');
} finally {
    await prisma.$disconnect();
}
