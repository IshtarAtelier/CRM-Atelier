// ────────────────────────────────────────────────────────────────────────────
// LA CASILLA DEL LOCAL NO RECIBE COSTOS NI PUBLICIDAD.
//
// Regla de Ishtar del 25/9/2026: atelier.optica.cerro@ (la casilla que leen
// los vendedores) "NO debe recibir NADA de información de costos de
// laboratorios ni de inversiones en Meta, reportes de campañas, nada de eso".
// Ese día el reporte semanal de laboratorio —con todos los costos— le llegaba
// al local, porque iba a `ADMIN_EMAIL || ADMIN_ALERT_EMAILS` y ADMIN_EMAIL no
// está seteada en producción. Nadie lo había decidido: se cayó por un default.
//
// Las listas que llegan al local son ADMIN_ALERT_EMAILS, la bandeja de
// vendedores (SHARED_VENDOR_INBOX / VENDOR_ALERT_EMAILS / notificationEmailFor)
// y la dirección escrita a mano. Lo privado va a PRIVATE_ADMIN_EMAILS.
//
// Falla si:
//   1. Un archivo de un área PRIVADA (costos de laboratorio, gastos, cierre,
//      caja, anuncios, campañas, conversiones) usa una lista que llega al local.
//   2. Cualquier archivo que usa una lista que llega al local LEE costos o
//      inversión publicitaria (costo de producto, costo facturado por el lab,
//      gasto de Meta/Google). Es la red para lo que el punto 1 no nombra.
//   3. Alguien vuelve a escribir `ADMIN_EMAIL || ADMIN_ALERT_EMAILS`.
//
// Corre sin base y sin red, y en CI.
// Correr:  npm run check:casilla-local
// ────────────────────────────────────────────────────────────────────────────

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const RAIZ = new URL('../../', import.meta.url).pathname;

/** Lo que hace que un correo le llegue a la casilla del local. */
const LLEGA_AL_LOCAL = /ADMIN_ALERT_EMAILS|SHARED_VENDOR_INBOX|VENDOR_ALERT_EMAILS|notificationEmailFor|atelier\.optica\.cerro/;

/** Solo cuenta si el archivo efectivamente manda correo. */
const MANDA_CORREO = /sendEmail\(|sendMail\(|sendClientEmail\(/;

/** Áreas privadas: por ruta. */
const AREAS_PRIVADAS = [
    /^src\/services\/lab-recon\//,
    /^src\/services\/lab-providers\//,
    /^src\/services\/lab-audit\.service\.ts$/,
    /^src\/services\/optovision-audit\.service\.ts$/,
    /^src\/services\/lab-cost-reconciliation\.service\.ts$/,
    /^src\/services\/gastos\.service\.ts$/,
    /^src\/services\/report\.service\.ts$/,
    /^src\/services\/google-ads/,
    /^src\/services\/google-offline-conversions/,
    /^src\/services\/meta-/,
    /^src\/app\/api\/cron\/lab-/,
    /^src\/app\/api\/cron\/ads-/,
    /^src\/app\/api\/cron\/month-close\//,
    /^src\/app\/api\/cron\/daily-cash\//,
    /^src\/app\/api\/cron\/payment-report\//,
    /^src\/app\/api\/cron\/meta-/,
    /^src\/app\/api\/cron\/google-/,
    /^src\/lib\/zero-cost-alert\.ts$/,
];

/** Leer esto en un archivo que manda al local es mandarle costos o pauta. */
const DATO_PRIVADO = /productCostSnapshot|\bsystemCost\b|\bbilledNet\b|\bbilledTotal\b|labCostEntry|fetchGastoMensualArs|getGastoMensualArs|\bspend\b|costPerResult|\bcpc\b|\bcpm\b/;

const DEFAULT_PELIGROSO = /ADMIN_EMAIL\s*\|\|\s*ADMIN_ALERT_EMAILS/;

/** Quita comentarios para no acusar por una mención en un comentario. */
const sinComentarios = (s) => s
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:'"`])\/\/.*$/gm, '$1');

function* archivos(dir) {
    for (const nombre of readdirSync(dir)) {
        if (nombre === 'node_modules' || nombre.startsWith('.')) continue;
        const ruta = join(dir, nombre);
        const st = statSync(ruta);
        if (st.isDirectory()) yield* archivos(ruta);
        else if (/\.(ts|tsx|js|mjs|cjs)$/.test(nombre)) yield ruta;
    }
}

const fallas = [];
let revisados = 0;
for (const base of ['src', 'wa-service']) {
    let existe = true;
    try { statSync(join(RAIZ, base)); } catch { existe = false; }
    if (!existe) continue;
    for (const ruta of archivos(join(RAIZ, base))) {
        const rel = relative(RAIZ, ruta);
        const codigo = sinComentarios(readFileSync(ruta, 'utf8'));
        revisados++;
        if (DEFAULT_PELIGROSO.test(codigo)) {
            fallas.push(`${rel}: usa \`ADMIN_EMAIL || ADMIN_ALERT_EMAILS\`. Sin ADMIN_EMAIL en producción, cae a la lista que incluye al local.`);
        }
        if (!MANDA_CORREO.test(codigo) || !LLEGA_AL_LOCAL.test(codigo)) continue;
        if (AREAS_PRIVADAS.some(re => re.test(rel))) {
            fallas.push(`${rel}: es un área privada (costos, gastos o anuncios) y manda correo a una lista que incluye la casilla del local. Usá PRIVATE_ADMIN_EMAILS.`);
            continue;
        }
        const dato = codigo.match(DATO_PRIVADO);
        if (dato) {
            fallas.push(`${rel}: manda correo a una lista que incluye la casilla del local y lee «${dato[0]}» (costo o inversión publicitaria). Si ese dato va en el correo, usá PRIVATE_ADMIN_EMAILS.`);
        }
    }
}

if (fallas.length) {
    console.log('❌ La casilla del local no puede recibir costos de laboratorio, inversión en publicidad ni reportes de campañas:\n');
    for (const f of fallas) console.log(`  · ${f}`);
    console.log(`\n${fallas.length} problema(s). Regla de Ishtar del 25/9/2026 (ver PRIVATE_ADMIN_EMAILS en src/lib/constants.ts).`);
    process.exit(1);
}
console.log(`✅ Ningún correo de costos, gastos o anuncios le llega a la casilla del local (${revisados} archivos revisados).`);
