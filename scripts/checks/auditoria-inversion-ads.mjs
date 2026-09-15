/**
 * Auditoría de la INVERSIÓN en pauta: cuánto se puso, cuánto duró y qué volvió.
 *
 * Tres preguntas, en este orden:
 *   1. ¿Cuánto duró? Días con gasto de cada campaña, primer y último día.
 *      Una campaña que gastó todo en cuatro días no se compara con una que
 *      estiró el mismo dinero en treinta.
 *   2. ¿Qué devolvió? Para Meta se cruza contra el CRM por etiqueta de anuncio
 *      (chats → presupuestos → cierres → plata COBRADA, no facturada).
 *   3. ¿Estuvo bien invertida? Costo por chat, costo por cierre y retorno.
 *
 * Usa el MISMO cruce que la pantalla /admin/analitica/atribucion y que el
 * reporte de pauta (AttributionService): un solo lugar para esa cuenta.
 *
 * SOLO LECTURA.
 *
 * Uso:
 *   node --experimental-strip-types --import ./scripts/checks/_alias.mjs \
 *        scripts/checks/auditoria-inversion-ads.mjs [--prod] [--dias 90]
 */
import { readFileSync } from 'node:fs';

const args = process.argv;
const usarProd = args.includes('--prod');
const iDias = args.indexOf('--dias');
const DIAS = iDias !== -1 ? Number(args[iDias + 1]) : 90;
if (![7, 14, 30, 90].includes(DIAS)) {
    console.error('--dias acepta 7, 14, 30 o 90 (son los únicos rangos que Meta resuelve por preset).');
    process.exit(1);
}

const env = Object.fromEntries(
    readFileSync(new URL('../../.env', import.meta.url), 'utf8')
        .split('\n')
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]),
);

// La URL se fija ANTES de importar nada del proyecto: `@/lib/db` lee
// DATABASE_URL al cargarse, así que después ya es tarde.
if (usarProd) {
    if (!env.PROD_DATABASE_URL) { console.error('Falta PROD_DATABASE_URL en .env'); process.exit(1); }
    process.env.DATABASE_URL = env.PROD_DATABASE_URL;
}
for (const [k, v] of Object.entries(env)) if (!process.env[k]) process.env[k] = v;
console.log(`Base: ${usarProd ? 'PRODUCCIÓN' : 'local'} · ventana: ${DIAS} días\n`);

const { AttributionService } = await import('@/services/attribution.service');
const { GoogleAdsService } = await import('@/services/google-ads.service');

const plata = (n) => '$' + Math.round(n || 0).toLocaleString('es-AR');
const dia = (d) => new Date(d).toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });

const hoy = new Date();
const desdeIso = new Date(Date.now() - DIAS * 864e5).toISOString().slice(0, 10);
const hastaIso = hoy.toISOString().slice(0, 10);

// ── 1. GOOGLE: cuánto duró cada campaña ──────────────────────────────────────
console.log('═══ GOOGLE ADS ═══');
const gCamp = await GoogleAdsService.getCampanasArs(desdeIso, hastaIso);
if (!gCamp) {
    console.log('No se pudo leer Google Ads (credenciales o API).\n');
} else if (gCamp.length === 0) {
    console.log('Sin gasto en la ventana.\n');
} else {
    console.log('CAMPAÑA'.padEnd(34) + 'ESTADO'.padEnd(9) + 'GASTO'.padStart(11) + 'DÍAS'.padStart(6) + 'PRIMERO'.padStart(11) + 'ÚLTIMO'.padStart(11) + 'CONV'.padStart(7) + '$/CONV'.padStart(11));
    console.log('─'.repeat(100));
    let totalG = 0;
    for (const c of gCamp) {
        totalG += c.costo;
        console.log(
            c.nombre.slice(0, 33).padEnd(34) +
            (c.estado === 'ENABLED' ? 'Activa' : c.estado === 'PAUSED' ? 'Pausada' : c.estado.slice(0, 8)).padEnd(9) +
            plata(c.costo).padStart(11) +
            String(c.diasConGasto).padStart(6) +
            dia(c.primerDia).padStart(11) +
            dia(c.ultimoDia).padStart(11) +
            (c.conversiones ? c.conversiones.toFixed(1) : '—').padStart(7) +
            (c.conversiones > 0 ? plata(c.costo / c.conversiones) : '—').padStart(11),
        );
    }
    console.log('─'.repeat(100));
    console.log('TOTAL GOOGLE'.padEnd(43) + plata(totalG).padStart(11));
    console.log('\nOJO: las "conversiones" son las que cuenta Google (llamadas, formularios,');
    console.log('rutas en Maps), NO ventas cerradas. Google no deja etiqueta en el chat de');
    console.log('WhatsApp, así que su retorno en plata NO se puede cruzar contra el CRM.\n');
}

// ── 2. META: qué devolvió cada anuncio, cruzado contra el CRM ────────────────
console.log(`═══ META (cruzado con el CRM, ${DIAS} días) ═══`);
let filas = [];
try {
    filas = await AttributionService.porAnuncio(DIAS);
} catch (e) {
    console.log('No se pudo leer el gasto de Meta:', e.message, '\n');
}
if (filas.length) {
    console.log('ANUNCIO'.padEnd(30) + 'GASTO'.padStart(11) + 'CHATS'.padStart(7) + 'PRESUP'.padStart(8) + 'CIERRES'.padStart(9) + 'COBRADO'.padStart(13) + '$/CHAT'.padStart(9) + '$/CIERRE'.padStart(11) + 'RETORNO'.padStart(9));
    console.log('─'.repeat(107));
    const t = { gasto: 0, chats: 0, presup: 0, cierres: 0, cobrado: 0 };
    for (const f of filas) {
        t.gasto += f.gasto; t.chats += f.chats; t.presup += f.presupuestados; t.cierres += f.cierres; t.cobrado += f.cobrado;
        console.log(
            String(f.tag).slice(0, 29).padEnd(30) +
            plata(f.gasto).padStart(11) +
            String(f.chats).padStart(7) +
            String(f.presupuestados).padStart(8) +
            String(f.cierres).padStart(9) +
            plata(f.cobrado).padStart(13) +
            (f.costoPorChat ? plata(f.costoPorChat) : '—').padStart(9) +
            (f.cierres > 0 ? plata(f.gasto / f.cierres) : '—').padStart(11) +
            (f.gasto > 0 && f.cobrado > 0 ? (f.cobrado / f.gasto).toFixed(1) + '×' : '—').padStart(9),
        );
    }
    console.log('─'.repeat(107));
    console.log(
        'TOTAL META'.padEnd(30) + plata(t.gasto).padStart(11) + String(t.chats).padStart(7) +
        String(t.presup).padStart(8) + String(t.cierres).padStart(9) + plata(t.cobrado).padStart(13) +
        (t.chats ? plata(t.gasto / t.chats) : '—').padStart(9) +
        (t.cierres ? plata(t.gasto / t.cierres) : '—').padStart(11) +
        (t.gasto > 0 && t.cobrado > 0 ? (t.cobrado / t.gasto).toFixed(1) + '×' : '—').padStart(9),
    );
    console.log('\n"Cobrado" es plata que ENTRÓ (filas de Payment), no facturación.');
    console.log('"Retorno" es cobrado ÷ gasto: cuántos pesos volvieron por cada peso puesto.');
}
process.exit(0);
