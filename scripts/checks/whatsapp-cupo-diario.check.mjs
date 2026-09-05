/**
 * ¿Cuánto del cupo diario de WhatsApp se lleva el tráfico interno?
 *
 * SOLO LEE. Se conecta a la base de PRODUCCIÓN (`PROD_DATABASE_URL`) porque la
 * pregunta es sobre el volumen real, y la copia local no lo tiene.
 *
 * QUÉ MIDE Y POR QUÉ ASÍ: Meta no limita "mensajes", limita CONVERSACIONES
 * INICIADAS por el negocio, y el límite es POR NÚMERO (hoy TIER_250 = 250 por
 * día). Una conversación la inicia un saliente mandado con la ventana de 24 h
 * cerrada, que es exactamente cuando el sistema manda PLANTILLA. Por eso el
 * proxy es `templateName IS NOT NULL`: un saliente de texto libre viaja dentro
 * de una conversación que ya estaba abierta y no consume cupo nuevo.
 *
 * La pregunta que responde: de esas conversaciones, cuántas son a CLIENTES
 * (ventas) y cuántas son avisos INTERNOS al equipo. Si las internas son
 * muchas, conviene una línea de administración aparte — tendría su propio
 * cupo y dejaría de competir con las ventas.
 *
 *   node scripts/checks/whatsapp-cupo-diario.check.mjs [días]   (por defecto 30)
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const DIAS = Number(process.argv[2] || 30);
const TIER = 250;

/** Plantillas que NO van a un cliente: son avisos al propio equipo. */
const INTERNAS = new Set(['nota_interna', 'aviso_pago_interno', 'derivation_notification', 'derivation_notification_2']);

const url = process.env.PROD_DATABASE_URL;
if (!url) { console.error('Falta PROD_DATABASE_URL en el .env.'); process.exit(1); }

// Consulta CRUDA a propósito: el schema local está adelantado respecto de
// producción, y dejar que Prisma arme el SELECT de la fila entera revienta
// (trampa conocida del repo).
const prisma = new PrismaClient({ datasourceUrl: url });
const rows = await prisma.$queryRawUnsafe(`
    SELECT to_char(date_trunc('day', m."createdAt" AT TIME ZONE 'America/Argentina/Cordoba'), 'YYYY-MM-DD') AS dia,
           m."templateName" AS plantilla,
           count(*)::int AS n
      FROM "WhatsAppMessage" m
     WHERE m.direction = 'OUTBOUND'
       AND m."templateName" IS NOT NULL
       AND m."createdAt" > now() - interval '${DIAS} days'
     GROUP BY 1, 2
     ORDER BY 1 DESC
`);
await prisma.$disconnect();

if (!rows.length) {
    console.log(`Sin conversaciones iniciadas por plantilla en los últimos ${DIAS} días.`);
    process.exit(0);
}

const porDia = new Map();
const totales = new Map();
for (const r of rows) {
    const d = r.dia;
    const esInterna = INTERNAS.has(r.plantilla);
    const acc = porDia.get(d) || { cliente: 0, interna: 0 };
    acc[esInterna ? 'interna' : 'cliente'] += r.n;
    porDia.set(d, acc);
    totales.set(r.plantilla, (totales.get(r.plantilla) || 0) + r.n);
}

const dias = [...porDia.entries()].sort((a, b) => b[0].localeCompare(a[0]));
const sum = k => dias.reduce((t, [, v]) => t + v[k], 0);
const totCliente = sum('cliente'), totInterna = sum('interna');
const pico = Math.max(...dias.map(([, v]) => v.cliente + v.interna));

console.log(`\nConversaciones iniciadas (plantillas) — últimos ${DIAS} días · límite del número: ${TIER}/día\n`);
console.log('  fecha        clientes   internas   total   % del cupo');
for (const [d, v] of dias.slice(0, 14)) {
    const t = v.cliente + v.interna;
    const barra = '█'.repeat(Math.round((t / TIER) * 40));
    console.log(`  ${d}  ${String(v.cliente).padStart(8)}   ${String(v.interna).padStart(8)}   ${String(t).padStart(5)}   ${String(Math.round(t / TIER * 100)).padStart(3)}%  ${barra}`);
}

console.log(`\n  Promedio por día: ${(( totCliente + totInterna) / dias.length).toFixed(1)}  ·  Día pico: ${pico} (${Math.round(pico / TIER * 100)}% del cupo)`);
console.log(`  Del total: ${totCliente} a clientes · ${totInterna} internas (${totInterna + totCliente ? Math.round(totInterna / (totInterna + totCliente) * 100) : 0}% del tráfico)`);

console.log('\n  Por plantilla:');
for (const [p, n] of [...totales.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${INTERNAS.has(p) ? '🏠 interna ' : '👤 cliente '} ${String(n).padStart(5)}  ${p}`);
}

console.log(`\n  ${pico > TIER * 0.7
    ? `⚠️  El día pico usó el ${Math.round(pico / TIER * 100)}% del cupo: estás cerca del techo.`
    : `El día pico usó el ${Math.round(pico / TIER * 100)}% del cupo: hoy sobra lugar.`}`);
