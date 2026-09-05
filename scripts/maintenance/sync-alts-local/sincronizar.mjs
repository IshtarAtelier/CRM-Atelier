// ────────────────────────────────────────────────────────────────────────────
// Sincroniza `WebProduct.imageAlts` de PRODUCCIÓN → base LOCAL. Solo eso.
//
// PARA QUÉ ES
// El filtro de color (5/9/26) lee el color del alt de la foto, que en
// producción está casi completo (110/115 productos) pero en la base local del
// desarrollador está casi vacío (1/106) — es una foto vieja de antes de que se
// cargaran los alts. Sin este script, el filtro de color no se puede probar de
// verdad en local: se vería siempre vacío, no porque el código esté mal sino
// porque falta el dato de origen.
//
// QUÉ HACE Y QUÉ NO
// LEE `imageAlts` de PRODUCCIÓN (solo lectura, vía AUDIT_DB_URL — mismo patrón
// que `scripts/checks/audit-*.mjs`) y ESCRIBE esos mismos valores en la base
// LOCAL, emparejando por `slug` (estable en las dos bases). No toca ningún
// otro campo, no toca producción, no inventa nada: copia lo que ya hay.
//
// Uso: node --experimental-strip-types scripts/maintenance/sync-alts-local/sincronizar.mjs
// ────────────────────────────────────────────────────────────────────────────

import { PrismaClient } from '@prisma/client';

const prodUrl = process.env.PROD_DATABASE_URL;
if (!prodUrl) {
    console.error('❌ Falta PROD_DATABASE_URL en el entorno (se lee de .env).');
    process.exit(1);
}

const localUrl = process.env.DATABASE_URL;
if (!localUrl) {
    console.error('❌ Falta DATABASE_URL en el entorno.');
    process.exit(1);
}
// Guarda real, no cosmética: si por lo que sea DATABASE_URL terminara siendo
// la MISMA base que PROD_DATABASE_URL (un .env mal pisado), este script
// ESCRIBE — no puede arriesgarse a hacerlo contra producción. Se compara el
// host:puerto/base, no el string entero (usuario/contraseña pueden diferir en
// la forma de escribirse sin que la base sea otra).
const partes = (u) => { try { const x = new URL(u); return `${x.hostname}:${x.port}${x.pathname}`; } catch { return u; } };
if (partes(localUrl) === partes(prodUrl)) {
    console.error('❌ DATABASE_URL y PROD_DATABASE_URL apuntan a la misma base. Este script ESCRIBE — no sigue.');
    process.exit(1);
}

const prod = new PrismaClient({ datasources: { db: { url: prodUrl } } });
const local = new PrismaClient({ datasources: { db: { url: localUrl } } });

const main = async () => {
    const productosProd = await prod.webProduct.findMany({
        where: { isActive: true },
        select: { slug: true, imageAlts: true },
    });
    console.log(`Producción: ${productosProd.length} productos activos.`);

    let actualizados = 0, sinCambios = 0, sinMatchLocal = 0;
    for (const p of productosProd) {
        if (!p.imageAlts || p.imageAlts.length === 0) { sinCambios++; continue; }
        const local_row = await local.webProduct.findUnique({ where: { slug: p.slug }, select: { id: true, imageAlts: true } });
        if (!local_row) { sinMatchLocal++; continue; }
        const yaIgual = JSON.stringify(local_row.imageAlts) === JSON.stringify(p.imageAlts);
        if (yaIgual) { sinCambios++; continue; }
        await local.webProduct.update({ where: { id: local_row.id }, data: { imageAlts: p.imageAlts } });
        actualizados++;
    }

    console.log(`Local actualizado: ${actualizados} | ya estaban igual: ${sinCambios} | sin match por slug: ${sinMatchLocal}`);
    await prod.$disconnect();
    await local.$disconnect();
};

main().catch(async (e) => {
    console.error(e);
    await prod.$disconnect().catch(() => {});
    await local.$disconnect().catch(() => {});
    process.exit(1);
});
