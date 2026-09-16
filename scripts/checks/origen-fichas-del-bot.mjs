/**
 * ¿Cuántas fichas creadas por el PORTERO (el bot) llegan sin ninguna referencia
 * de dónde vino el cliente, y cuántas de esas tienen la prueba a la vista en el
 * primer mensaje?
 *
 * Por qué importa (Ishtar, 16/9/2026): al vendedor el desplegable de origen le
 * queda obligatorio, pero la ficha que crea el bot nadie la elige a mano. Antes
 * de inventar una etiqueta "sin datos" hay que asegurarse de que de verdad no
 * haya dato: si la prueba está en el chat, lo que corresponde es leerla, no
 * marcarla como desconocida.
 *
 * Clasifica cada ficha del bot sin origen en tres montones:
 *   1. RESOLUBLE  — el primer mensaje prueba el origen (origenDeterministico).
 *   2. PISTA      — no hay prueba, pero el chat menciona algo (google, un
 *                   anuncio, una recomendación): lo puede resolver una persona
 *                   preguntando, no el sistema.
 *   3. SIN DATOS  — el chat entero no dice nada de dónde salió.
 *
 * SOLO LECTURA. No escribe una sola fila.
 *
 * Uso:
 *   node --experimental-strip-types --import ./scripts/checks/_alias.mjs scripts/checks/origen-fichas-del-bot.mjs --prod [--dias 90] [--json <archivo>]
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { origenDeterministico } = await import(pathToFileURL(resolve(raiz, 'src/lib/origen-deterministico.ts')).href);
const { platformFromStoredTag, fallbackAdTag } = await import(pathToFileURL(resolve(raiz, 'src/lib/ads/ad-tag-core.ts')).href);

const args = process.argv.slice(2);
const usarProd = args.includes('--prod');
const idxDias = args.indexOf('--dias');
const DIAS = idxDias !== -1 ? Number(args[idxDias + 1]) : 90;
const idxJson = args.indexOf('--json');
const salidaJson = idxJson !== -1 ? args[idxJson + 1] : null;

const env = Object.fromEntries(
    readFileSync(new URL('../../.env', import.meta.url), 'utf8')
        .split('\n')
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]),
);
const url = usarProd ? env.PROD_DATABASE_URL : env.DATABASE_URL;
if (!url) { console.error(`No encontré ${usarProd ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en .env`); process.exit(1); }
console.log(`Base: ${usarProd ? 'PRODUCCIÓN' : 'local'} — últimos ${DIAS} días\n`);

const prisma = new PrismaClient({ datasourceUrl: url });

/** Quién crea la ficha: el portero automático o una persona. Mismo criterio que contact.service. */
const ES_BOT = /bot|sistema \(pasivo\)/i;

/** Palabras que dejan una PISTA aunque no prueben nada: las puede resolver una persona preguntando. */
const PISTAS = [
    [/\bgoogle\b|\bbusca(ndo|r|)\b|\bbuscador\b|\binternet\b/i, 'menciona google/búsqueda'],
    [/\bmaps?\b|\bcómo llego\b|\bcomo llego\b|\bubicaci[oó]n\b|\bdirecci[oó]n\b/i, 'pregunta por la ubicación'],
    [/\binstagram\b|\big\b|\bface\b|\bfacebook\b|\breel\b|\bhistoria\b|\bstory\b/i, 'menciona una red'],
    [/\banuncio\b|\bpublicidad\b|\bpauta\b|\bpromo(ci[oó]n|)\b/i, 'menciona un anuncio'],
    [/\brecomend|\bme pasaron\b|\bme dijeron\b|\bamig|\bmi (mam[aá]|pap[aá]|hermana?|t[ií]a?)\b|\bclienta? de ustedes\b/i, 'menciona a quien lo recomendó'],
    [/\bpas[eé] por\b|\bvidriera\b|\bel local\b|\bpor la calle\b|\bfrente\b/i, 'menciona el local/la vidriera'],
    [/\bweb\b|\bp[aá]gina\b|\bsitio\b|atelieroptica|\btienda\b/i, 'menciona la web'],
    [/\bya (soy|fui|era)\b|\bla otra vez\b|\bel a[ñn]o pasado\b|\bcompr[eé] (ah[ií]|con ustedes)\b/i, 'dice que ya fue cliente'],
];

const pistaDe = (texto) => PISTAS.find(([re]) => re.test(texto))?.[1] ?? null;

try {
    const desde = new Date(Date.now() - DIAS * 24 * 60 * 60 * 1000);

    const fichas = await prisma.client.findMany({
        where: { createdAt: { gte: desde }, isDeleted: false },
        select: { id: true, name: true, phone: true, contactSource: true, adTag: true, createdBy: true, createdAt: true },
        orderBy: { createdAt: 'asc' },
    });

    const delBot = fichas.filter((c) => ES_BOT.test(c.createdBy || ''));
    const dePersona = fichas.filter((c) => !ES_BOT.test(c.createdBy || ''));

    console.log('═══ Cuántas fichas crea cada uno ═══');
    console.log(`  Total en el período: ${fichas.length}`);
    console.log(`  Las crea el portero (bot): ${delBot.length} (${Math.round((delBot.length / (fichas.length || 1)) * 100)}%)`);
    console.log(`  Las crea una persona:      ${dePersona.length}`);
    const sinOrigenPersona = dePersona.filter((c) => !c.contactSource?.trim()).length;
    console.log(`     └ de esas, sin origen: ${sinOrigenPersona}`);

    const sinOrigen = delBot.filter((c) => !c.contactSource?.trim());
    console.log(`\n═══ Fichas del portero SIN origen cargado: ${sinOrigen.length} de ${delBot.length} ═══`);

    // El chat de cada una, con sus mensajes ENTRANTES (lo que dijo el cliente).
    const chats = await prisma.whatsAppChat.findMany({
        where: { clientId: { in: sinOrigen.map((c) => c.id) } },
        select: {
            clientId: true, adTag: true, profileName: true,
            messages: { where: { direction: 'INBOUND' }, select: { content: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
        },
    });
    const chatPorCliente = new Map(chats.map((ch) => [ch.clientId, ch]));

    const montones = { resoluble: [], pista: [], sinDatos: [], sinChat: [] };

    for (const c of sinOrigen) {
        const chat = chatPorCliente.get(c.id);
        if (!chat || chat.messages.length === 0) { montones.sinChat.push({ ...c, motivo: 'la ficha no tiene chat con mensajes del cliente' }); continue; }

        const primero = chat.messages.find((m) => (m.content || '').trim())?.content || '';

        // 1) La etiqueta YA GUARDADA es prueba dura: la escribió el portero al
        //    entrar el clic del anuncio. Sin prefijo `google:` es de Meta
        //    (platformFromStoredTag), y así la leen los reportes.
        const guardada = c.adTag || chat.adTag;
        if (guardada) {
            const plat = platformFromStoredTag(guardada);
            montones.resoluble.push({ ...c, origen: plat === 'GOOGLE' ? 'Google Ads' : 'Meta', motivo: `el chat tiene guardada la etiqueta del anuncio (${guardada})`, primero });
            continue;
        }

        // 2) Cualquier mensaje entrante que pruebe el origen, el PRIMERO que lo
        //    pruebe (primer toque). Antes miraba solo el primer mensaje y los
        //    entrantes vacíos de Meta lo dejaban ciego.
        let det = null;
        for (const m of chat.messages) { det = origenDeterministico(m.content || ''); if (det) break; }
        if (det) { montones.resoluble.push({ ...c, origen: det.origen, motivo: det.motivo, primero }); continue; }

        // 3) Prefill genérico de Meta / "los vi en meta" sueltos.
        const fb = chat.messages.map((m) => fallbackAdTag(m.content || '')).find(Boolean);
        if (fb) { montones.resoluble.push({ ...c, origen: 'Meta', motivo: 'el mensaje es un prefill de anuncio de Meta sin etiqueta', primero }); continue; }

        const todo = chat.messages.map((m) => m.content || '').join(' \n ');
        const pista = pistaDe(todo);
        if (pista) { montones.pista.push({ ...c, motivo: pista, primero }); continue; }

        montones.sinDatos.push({ ...c, primero, mensajes: chat.messages.length, conTexto: chat.messages.filter((m) => (m.content || '').trim()).length });
    }

    const pct = (n) => `${n} (${Math.round((n / (sinOrigen.length || 1)) * 100)}%)`;
    console.log(`  1. El primer mensaje PRUEBA el origen → ${pct(montones.resoluble.length)}`);
    console.log(`  2. Hay una PISTA que puede resolver una persona → ${pct(montones.pista.length)}`);
    console.log(`  3. El chat entero no dice NADA (sin datos de verdad) → ${pct(montones.sinDatos.length)}`);
    console.log(`  4. Sin chat con mensajes del cliente → ${pct(montones.sinChat.length)}`);

    if (montones.resoluble.length) {
        console.log('\n─── 1. Resolubles solas (la regla ya deployada las decide) ───');
        const porOrigen = {};
        for (const f of montones.resoluble) porOrigen[f.origen] = (porOrigen[f.origen] || 0) + 1;
        for (const [o, n] of Object.entries(porOrigen).sort((a, b) => b[1] - a[1])) console.log(`  ${o}: ${n}`);
        for (const f of montones.resoluble.slice(0, 12)) console.log(`   · ${f.name} — ${f.origen} (${f.motivo}) — "${f.primero.replace(/\s+/g, ' ').slice(0, 80)}"`);
    }

    if (montones.pista.length) {
        console.log('\n─── 2. Con pista (hay que preguntarle al cliente, no inventarlo) ───');
        const porPista = {};
        for (const f of montones.pista) porPista[f.motivo] = (porPista[f.motivo] || 0) + 1;
        for (const [m, n] of Object.entries(porPista).sort((a, b) => b[1] - a[1])) console.log(`  ${m}: ${n}`);
    }

    if (montones.sinDatos.length) {
        console.log('\n─── 3. Sin ninguna referencia (candidatas a la etiqueta "sin datos") ───');
        for (const f of montones.sinDatos.slice(0, 25)) {
            console.log(`   · ${f.name} (${f.mensajes} msj) — "${(f.primero || '').replace(/\s+/g, ' ').slice(0, 90)}"`);
        }
        if (montones.sinDatos.length > 25) console.log(`   … y ${montones.sinDatos.length - 25} más`);
    }

    if (salidaJson) {
        writeFileSync(salidaJson, JSON.stringify({ generado: new Date().toISOString(), dias: DIAS, total: fichas.length, delBot: delBot.length, sinOrigen: sinOrigen.length, montones }, null, 2));
        console.log(`\nDetalle completo en ${salidaJson}`);
    }
} finally {
    await prisma.$disconnect();
}
