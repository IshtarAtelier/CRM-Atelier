/**
 * ¿Cuántos chats que vinieron de un anuncio de Meta podemos probar que vinieron
 * de ahí, sin depender del mensajito precargado?
 *
 * La prueba es el `referral` que manda la Cloud API con el clic: trae el id del
 * anuncio por fuera del texto, así que vale aunque el cliente lo borre. Este
 * script mide la cobertura y traduce cada id al nombre del anuncio y de la
 * campaña preguntándole a Meta (con caché en la tabla MetaAd).
 *
 * Qué mirar:
 *   · "con id del anuncio" tiene que crecer todos los días desde el 16/9/2026.
 *     Si se queda en cero, el referral no está llegando y hay que revisar el
 *     webhook antes que cualquier otra cosa.
 *   · "solo por texto" son los que hoy dependen del mensajito: quedan
 *     identificados igual, pero si esa persona lo borra, no queda rastro.
 *
 * SOLO LECTURA. No escribe en la base de producción salvo la caché de nombres.
 *
 * Uso:
 *   node --experimental-strip-types --import ./scripts/checks/_alias.mjs scripts/checks/meta-anuncios-identificados.mjs --prod [--dias 30]
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const usarProd = args.includes('--prod');
const idxDias = args.indexOf('--dias');
const DIAS = idxDias !== -1 ? Number(args[idxDias + 1]) : 30;

const env = Object.fromEntries(
    readFileSync(new URL('../../.env', import.meta.url), 'utf8')
        .split('\n')
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]),
);
const url = usarProd ? env.PROD_DATABASE_URL : env.DATABASE_URL;
if (!url) { console.error('Falta la URL de la base en .env'); process.exit(1); }
console.log(`Base: ${usarProd ? 'PRODUCCIÓN' : 'local'} — últimos ${DIAS} días\n`);

const prisma = new PrismaClient({ datasourceUrl: url });

/** Consulta directa a Meta, sin depender del módulo del CRM (este script corre suelto). */
async function nombreDelAnuncio(adId, token) {
    if (!token) return null;
    const u = new URL(`https://graph.facebook.com/v24.0/${adId}`);
    u.searchParams.set('fields', 'name,campaign{name}');
    u.searchParams.set('access_token', token);
    try {
        const j = await (await fetch(u)).json();
        return j?.error ? null : { name: j.name ?? null, campaignName: j.campaign?.name ?? null };
    } catch { return null; }
}

try {
    const desde = new Date(Date.now() - DIAS * 24 * 60 * 60 * 1000);
    // SQL directo a propósito: este script tiene que poder correr aunque el
    // cliente de Prisma generado sea de otra rama (node_modules es compartido
    // entre worktrees y se pisa entre sesiones).
    let chats;
    try {
        chats = await prisma.$queryRaw`
            SELECT "adTag", "adSourceId", "adCtwaClid"
            FROM "WhatsAppChat"
            WHERE "createdAt" >= ${desde}
        `;
    } catch (e) {
        if (e?.meta?.code === '42703') {
            console.log('Esta base todavía no tiene las columnas del referral: falta que corra el deploy.');
            console.log('(la migración 20260916_referral_click_to_whatsapp se aplica sola al desplegar)');
            process.exit(0);
        }
        throw e;
    }

    const conId = chats.filter((c) => c.adSourceId);
    const soloTexto = chats.filter((c) => !c.adSourceId && c.adTag && !c.adTag.startsWith('google:'));
    const sinNada = chats.length - conId.length - soloTexto.length;

    console.log('═══ Chats nuevos y cómo se prueba que vinieron de un anuncio ═══');
    console.log(`  total: ${chats.length}`);
    console.log(`  con id del anuncio (prueba de Meta, sobrevive al borrado): ${conId.length}`);
    console.log(`  solo por el texto precargado:                              ${soloTexto.length}`);
    console.log(`  con id del clic (sirve para contarle la venta a Meta):     ${conId.filter((c) => c.adCtwaClid).length}`);
    console.log(`  sin señal de anuncio:                                     ${sinNada}`);

    if (conId.length) {
        const token = env.META_ADS_TOKEN || env.META_ACCESS_TOKEN;
        const porAnuncio = {};
        for (const c of conId) porAnuncio[c.adSourceId] = (porAnuncio[c.adSourceId] || 0) + 1;
        console.log('\n─── Por anuncio (nombre traído de Meta) ───');
        for (const [id, n] of Object.entries(porAnuncio).sort((a, b) => b[1] - a[1])) {
            const meta = await nombreDelAnuncio(id, token);
            console.log(`  ${String(n).padStart(4)}  ${meta?.name || '(sin nombre)'}${meta?.campaignName ? ' · ' + meta.campaignName : ''}   [${id}]`);
        }
    } else {
        console.log('\n⚠️  Todavía ningún chat con id de anuncio. Si ya pasaron días desde el deploy,');
        console.log('    revisar que el webhook de Meta esté entregando el objeto `referral`.');
    }
} finally {
    await prisma.$disconnect();
}
