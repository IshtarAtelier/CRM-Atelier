// ────────────────────────────────────────────────────────────────────────────
// Oportunidades de cierre de UN MES que no compraron: quiénes son, qué
// seguimientos recibió cada una y a quién se puede volver a escribir.
//
// SOLO LEE (consultas crudas, ni un UPDATE). Sin --prod usa la base local.
//
//   node --env-file=.env scripts/checks/cierres-mes-pasado.check.mjs --prod [--mes=2026-09] [--lista]
//
// --mes   mes de Córdoba a mirar (por defecto, el mes pasado)
// --lista imprime además persona por persona
// ────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const url = args.prod ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.error('Falta la URL de la base.'); process.exit(1); }
const prisma = new PrismaClient({ datasourceUrl: url });
const q = (sql, ...p) => prisma.$queryRawUnsafe(sql, ...p);

const hoy = new Date();
const porDefecto = new Date(Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
const MES = typeof args.mes === 'string' ? args.mes : porDefecto;
const [anio, mes] = MES.split('-').map(Number);
// Medianoche de Córdoba (UTC-3) del primer día del mes y del siguiente.
const DESDE = new Date(Date.UTC(anio, mes - 1, 1, 3));
const HASTA = new Date(Date.UTC(anio, mes, 1, 3));

const EXCLUSION = ['no interesado', 'cancelar bot', 'spam', 'no bot', 'cerrado', 'post-venta', 'sin seguimiento', 'no cliente', 'proveedor', 'laboratorio', 'mayorista'];
const plata = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-AR');
const dias = (d) => d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400e3) : null;

console.log(`\n— Oportunidades de ${MES} que no compraron (base: ${args.prod ? 'PRODUCCIÓN' : 'local'}, solo lectura) —\n`);

// Una fila por persona con algún movimiento en el mes: presupuesto, venta o
// ficha nueva. OJO: al vender, la MISMA fila pasa de QUOTE a SALE — por eso la
// base no puede ser "quien tiene un presupuesto" (así se perdían los que
// compraron: la primera versión contaba 21 ventas donde había 80).
const filas = await q(`
  WITH mov AS (
    SELECT DISTINCT ON (o."clientId") o."clientId", o."createdAt" AS ref, o.total, o.status
      FROM "Order" o
     WHERE o."isDeleted" = false AND o."createdAt" >= $1 AND o."createdAt" < $2
     ORDER BY o."clientId", o."createdAt" DESC
  ), base AS (
    SELECT c.id, c.name, c.status, c."opportunityDismissedAt" AS descartada,
           COALESCE(p.ref, c."createdAt") AS ref, p.total, (p."clientId" IS NOT NULL) AS con_presupuesto,
           (p.status = 'LOST') AS perdido
      FROM "Client" c LEFT JOIN mov p ON p."clientId" = c.id
     WHERE c."isDeleted" = false
       AND (p."clientId" IS NOT NULL
            OR (c."createdAt" >= $1 AND c."createdAt" < $2
                AND NOT EXISTS (SELECT 1 FROM "Order" o WHERE o."clientId" = c.id AND o."isDeleted" = false)))
  )
  SELECT b.*,
         EXISTS (SELECT 1 FROM "Order" o WHERE o."clientId" = b.id AND o."isDeleted" = false
                    AND o."orderType" IN ('SALE','ORDER') AND o."createdAt" >= $1) AS compro,
         (SELECT string_agg(lower(t.name), '|') FROM "_ClientToTag" ct JOIN "Tag" t ON t.id = ct."B" WHERE ct."A" = b.id) AS tags,
         ch.id AS chat_id, ch."chatLabels" AS labels, ch."lastFollowUpAt" AS ultimo_seg, ch."lastInboundAt" AS ultimo_entrante,
         ch."followUpPausedUntil" AS pausa,
         (SELECT count(*)::int FROM "WhatsAppMessage" m WHERE m."chatId" = ch.id AND m.direction = 'OUTBOUND'
              AND m."templateName" IS NOT NULL AND m."createdAt" > b.ref) AS plantillas,
         (SELECT string_agg(DISTINCT m."templateName", ',') FROM "WhatsAppMessage" m WHERE m."chatId" = ch.id AND m.direction = 'OUTBOUND'
              AND m."templateName" IS NOT NULL AND m."createdAt" > b.ref) AS cuales,
         (SELECT max(m."createdAt") FROM "WhatsAppMessage" m WHERE m."chatId" = ch.id AND m.direction = 'OUTBOUND'
              AND COALESCE(m."senderName", '') NOT IN ('Bot','Sistema','Sistema Atelier') AND m."createdAt" > b.ref) AS ultimo_humano,
         (SELECT max(m."createdAt") FROM "WhatsAppMessage" m WHERE m."chatId" = ch.id AND m.direction = 'OUTBOUND') AS ultimo_saliente,
         (SELECT count(*)::int FROM "WhatsAppMessage" m WHERE m."chatId" = ch.id AND m.direction = 'OUTBOUND'
              AND m.status = 'FAILED' AND m."createdAt" > b.ref) AS fallidos,
         (SELECT m.direction FROM "WhatsAppMessage" m WHERE m."chatId" = ch.id ORDER BY m."createdAt" DESC LIMIT 1) AS ultima_dir,
         (SELECT left(m.content, 110) FROM "WhatsAppMessage" m WHERE m."chatId" = ch.id AND m.direction = 'INBOUND' ORDER BY m."createdAt" DESC LIMIT 1) AS ultimo_texto
    FROM base b
    LEFT JOIN LATERAL (SELECT * FROM "WhatsAppChat" w WHERE w."clientId" = b.id ORDER BY w."lastMessageAt" DESC NULLS LAST LIMIT 1) ch ON true
`, DESDE, HASTA);

const total = filas.length;
const compraron = filas.filter(f => f.compro);
const perdidos = filas.filter(f => !f.compro && f.perdido);
const noCompraron = filas.filter(f => !f.compro && !f.perdido);
console.log(`Personas con presupuesto, venta o alta en el mes: ${total}`);
console.log(`  compraron (venta desde el 1º del mes):      ${compraron.length}`);
console.log(`  presupuesto marcado PERDIDO a mano:          ${perdidos.length}  (${plata(perdidos.reduce((a, f) => a + (f.total || 0), 0))})`);
console.log(`  NO compraron y siguen abiertas:              ${noCompraron.length}  (presupuestado: ${plata(noCompraron.reduce((a, f) => a + (f.total || 0), 0))})`);

const clasificar = (f) => {
    const tags = f.tags || '';
    if (['CLIENT', 'active'].includes(f.status)) return 'ya es cliente (compró antes; presupuesto nuevo sin cerrar)';
    if (EXCLUSION.some(x => tags.includes(x)) || (f.labels || []).includes('SIN_SEGUIMIENTO')) return 'excluida (no interesado / sin seguimiento / no cliente)';
    if (!f.chat_id) return 'sin chat de WhatsApp';
    if (f.pausa && new Date(f.pausa) > new Date()) return 'pausada';
    const respondio = f.ultimo_entrante && f.ultimo_seg && new Date(f.ultimo_entrante) > new Date(f.ultimo_seg);
    if (respondio) return 'respondió al último seguimiento (la sigue una persona)';
    // El orden de los toques cambió el 12/9: los de antes recibieron 1º y último
    // sin la invitación. Lo que cierra la secuencia es el último, no la cuenta.
    const labels = f.labels || [];
    if (labels.includes('SEGUIMIENTO_DIA_15')) return 'secuencia COMPLETA (recibió el último toque, con descuento) y no contestó';
    if (labels.some(l => /^SEGUIMIENTO_DIA_/.test(l))) return 'secuencia EN CURSO (le falta algún toque) y todavía no contestó';
    if (f.ultimo_humano) return 'sin toques del embudo, pero una persona le escribió';
    return 'NUNCA recibió seguimiento';
};

const grupos = new Map();
for (const f of noCompraron) { const k = clasificar(f); f.grupo = k; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(f); }
console.log('\nLas que NO compraron, por situación:');
for (const [k, v] of [...grupos].sort((a, b) => b[1].length - a[1].length)) {
    const conP = v.filter(f => f.con_presupuesto);
    console.log(`  ${String(v.length).padStart(4)}  ${k}  — ${conP.length} con presupuesto (${plata(conP.reduce((a, f) => a + (f.total || 0), 0))}), ${v.filter(f => (f.total || 0) >= 250000).length} de ticket alto`);
}

// Días desde el último mensaje que les mandó cualquiera (para no pisar charlas).
const silencio = noCompraron.filter(f => f.chat_id).map(f => dias(f.ultimo_saliente)).filter(d => d != null);
const tramo = (a, b) => silencio.filter(d => d >= a && d < b).length;
console.log(`\nHace cuánto nadie les escribe (con chat): <3 días ${tramo(0, 3)} · 3-7 ${tramo(3, 7)} · 7-14 ${tramo(7, 14)} · 14+ ${tramo(14, 9999)}`);
console.log(`Con algún envío rechazado por Meta: ${noCompraron.filter(f => f.fallidos > 0).length}`);

// Los que respondieron: ¿alguien les contestó, o la última palabra es de ellos?
const resp = noCompraron.filter(f => f.grupo.startsWith('respondió'));
const colgados = resp.filter(f => f.ultima_dir === 'INBOUND');
const edadC = (a, b) => colgados.filter(f => { const d = dias(f.ultimo_entrante); return d >= a && d < b; }).length;
console.log(`\nDe las ${resp.length} que respondieron: en ${colgados.length} la ÚLTIMA palabra es del cliente (nadie contestó después): hace <2 días ${edadC(0, 2)} · 2-7 ${edadC(2, 7)} · 7+ ${edadC(7, 9999)}`);
const callados = resp.filter(f => f.ultima_dir !== 'INBOUND');
const edadS = (a, b) => callados.filter(f => { const d = dias(f.ultimo_saliente); return d >= a && d < b; }).length;
console.log(`  en las otras ${callados.length} contestamos y el cliente no siguió: hace <3 días ${edadS(0, 3)} · 3-7 ${edadS(3, 7)} · 7-14 ${edadS(7, 14)} · 14+ ${edadS(14, 9999)}`);

const completa = noCompraron.filter(f => f.grupo.startsWith('secuencia COMPLETA'));
const edadK = (a, b) => completa.filter(f => { const d = dias(f.ultimo_saliente); return d >= a && d < b; }).length;
console.log(`De las ${completa.length} con secuencia completa: último mensaje nuestro hace <7 días ${edadK(0, 7)} · 7-14 ${edadK(7, 14)} · 14+ ${edadK(14, 9999)}`);

const plantillas = {};
for (const f of noCompraron) for (const p of (f.cuales || '').split(',').filter(Boolean)) plantillas[p] = (plantillas[p] || 0) + 1;
console.log('\nPlantillas que ya recibieron (personas):');
for (const [p, n] of Object.entries(plantillas).sort((a, b) => b[1] - a[1])) console.log(`  ${String(n).padStart(4)}  ${p}`);

// ── Salud del motor en los últimos 14 días ───────────────────────────────────
console.log('\nMotor de seguimientos, últimos 14 días:');
for (const r of await q(`
  SELECT "diaArt" dia, count(*)::int corridas, sum(enviados)::int enviados, sum(fallidos)::int fallidos,
         max("enEspera")::int en_espera, count(*) FILTER (WHERE error IS NOT NULL)::int con_error, string_agg(DISTINCT modo, ',') modo
    FROM "SeguimientoCorrida" WHERE "createdAt" > now() - interval '14 days' GROUP BY 1 ORDER BY 1`))
    console.log(`  ${r.dia}  corridas ${String(r.corridas).padStart(2)}  enviados ${String(r.enviados).padStart(3)}  fallidos ${String(r.fallidos).padStart(2)}  en espera ${String(r.en_espera).padStart(3)}  errores ${r.con_error}  modo ${r.modo}`);

console.log('\nInterruptores:');
for (const r of await q(`SELECT key, value FROM "SystemSetting" WHERE key IN ('followups_enabled','seguimientos_auto_modo','seguimientos_cupo_diario','seguimientos_freno_hasta')`))
    console.log(`  ${r.key} = ${r.value}`);

console.log('\nPlantillas salientes por día, últimos 7 días (cupo de Meta: 250):');
for (const r of await q(`
  SELECT to_char((m."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Argentina/Cordoba', 'YYYY-MM-DD') dia, count(*)::int n,
         count(*) FILTER (WHERE m.status = 'FAILED')::int fallidas
    FROM "WhatsAppMessage" m WHERE m.direction = 'OUTBOUND' AND m."templateName" IS NOT NULL AND m."createdAt" > now() - interval '7 days'
   GROUP BY 1 ORDER BY 1`)) console.log(`  ${r.dia}  ${String(r.n).padStart(3)}  (rechazadas ${r.fallidas})`);

if (args.lista) {
    console.log('\nPersona por persona (las que no compraron):');
    for (const f of noCompraron.sort((a, b) => (b.total || 0) - (a.total || 0)))
        console.log(`  ${(f.name || '').slice(0, 28).padEnd(28)} ${plata(f.total).padStart(12)}  hace ${String(dias(f.ref)).padStart(2)} d  último saliente hace ${String(dias(f.ultimo_saliente) ?? '—').padStart(2)} d  ${f.grupo}${f.ultima_dir === 'INBOUND' ? `  ⟵ "${(f.ultimo_texto || '').replace(/\s+/g, ' ')}"` : ''}`);
}
await prisma.$disconnect();
