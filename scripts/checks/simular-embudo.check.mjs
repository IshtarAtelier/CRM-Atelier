// ────────────────────────────────────────────────────────────────────────────
// SIMULACIÓN EN SECO DEL EMBUDO: qué le mandaría el motor a quién, día por día.
//
// Lee los leads de la base UNA vez (solo lectura) y simula N días con las
// mismas reglas del motor (classifyLead + playbook + compuertas + cupo),
// avanzando el reloj y anotando en memoria cada envío como si hubiera salido
// (etiqueta del escalón, lastFollowUpAt). No escribe nada en ninguna base.
//
//   node --env-file=.env --experimental-strip-types --import ./scripts/checks/_alias.mjs \
//     scripts/checks/simular-embudo.check.mjs --prod --dias=14 [--salida=/ruta/archivo.md]
//
// Sin --prod usa la base local. Supone que ningún cliente responde y que nadie
// del equipo escribe: es el peor caso (todo lo manda el motor).
// ────────────────────────────────────────────────────────────────────────────
import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';
import { classifyLead, VENTANA_EMBUDO_DIAS } from '../../src/lib/leads-pipeline.ts';
import { proximaAccion, ordenarPorUrgencia, ETIQUETA_POR_PLANTILLA } from '../../src/lib/embudo/playbook.ts';
import { presupuestoFueEnviado, MARCA_PDF_ENVIADO } from '../../src/lib/embudo/presupuesto-enviado.ts';
import { evaluar } from '../../src/lib/seguimientos/politica.ts';
import { CUPO_DIARIO_POR_DEFECTO, LOTE_POR_TICK, HORA_DESDE, HORA_HASTA } from '../../src/lib/constants/seguimientos.ts';
import { TAGS_NO_CLIENTE } from '../../src/lib/no-cliente.ts';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const DIAS = Number(args.dias) || 14;
const url = args.prod ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
const prisma = new PrismaClient({ datasources: { db: { url } } });
const D = 86400e3, H = 3600e3;
const EXCLUSION = ['no interesado', 'cancelar bot', 'spam', 'no bot', 'cerrado', 'post-venta', ...TAGS_NO_CLIENTE];
const REMITENTES_AUTOMATICOS = ['Bot', 'Sistema', 'Sistema Atelier'];

// ── Foto de la base (una vez) ────────────────────────────────────────────────
const leads = (await prisma.client.findMany({
    where: { status: 'CONTACT', isDeleted: false, orders: { none: { isDeleted: false, orderType: { in: ['SALE', 'ORDER'] } } } },
    select: {
        id: true, name: true, createdAt: true, tags: { select: { name: true } },
        prescriptions: { orderBy: { date: 'desc' }, take: 1, select: { id: true } },
        orders: { where: { isDeleted: false, orderType: 'QUOTE' }, orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true } },
        interactions: { where: { type: 'STORE_VISIT' }, select: { id: true }, take: 1 },
        whatsappChats: { orderBy: { lastMessageAt: 'desc' }, take: 1, select: { id: true, chatLabels: true, lastFollowUpAt: true, lastInboundAt: true, followUpPausedUntil: true } },
    },
})).filter(l => !l.tags.some(t => EXCLUSION.some(x => t.name.toLowerCase().includes(x))));
const chatIds = leads.map(l => l.whatsappChats[0]?.id).filter(Boolean);
const humanos = new Map((await prisma.whatsAppMessage.groupBy({ by: ['chatId'], where: { chatId: { in: chatIds }, direction: 'OUTBOUND', senderName: { notIn: REMITENTES_AUTOMATICOS } }, _max: { createdAt: true } })).map(x => [x.chatId, x._max.createdAt]));
const salientes = new Map((await prisma.whatsAppMessage.groupBy({ by: ['chatId'], where: { chatId: { in: chatIds }, direction: 'OUTBOUND' }, _max: { createdAt: true } })).map(x => [x.chatId, x._max.createdAt]));
const pdfs = new Map((await prisma.interaction.groupBy({ by: ['clientId'], where: { clientId: { in: leads.map(l => l.id) }, type: 'NOTE', content: { startsWith: MARCA_PDF_ENVIADO } }, _max: { createdAt: true } })).map(x => [x.clientId, x._max.createdAt]));
await prisma.$disconnect();

// ── Estado virtual por chat ──────────────────────────────────────────────────
const estado = new Map();
for (const l of leads) {
    const c = l.whatsappChats[0]; if (!c) continue;
    estado.set(c.id, { chatLabels: [...(c.chatLabels || [])], lastFollowUpAt: c.lastFollowUpAt, lastInboundAt: c.lastInboundAt, followUpPausedUntil: c.followUpPausedUntil, lastOutboundAt: salientes.get(c.id) || null, tagNames: l.tags.map(t => t.name) });
}

const inicio = new Date(); // mañana a las 10 de Córdoba
const primerDia = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate() + 1, 13, 0, 0));
const lineas = [`# Simulación en seco del embudo — ${DIAS} días desde ${primerDia.toISOString().slice(0, 10)}`, '', `Leads en el embudo: ${leads.length}. Supone que nadie responde y nadie del equipo escribe (peor caso). Cupo ${CUPO_DIARIO_POR_DEFECTO}/día, ${LOTE_POR_TICK} por hora de ${HORA_DESDE} a ${HORA_HASTA}.`, ''];
const resumen = [];
for (let d = 0; d < DIAS; d++) {
    const enviadosHoy = [];
    const vetosHoy = new Map();
    let esperaHoy = 0;
    for (let hora = HORA_DESDE; hora < HORA_HASTA; hora++) {
        const now = primerDia.getTime() + d * D + (hora - 10) * H;
        // el tablero de esa hora
        const paraHoy = [];
        for (const l of leads) {
            const chat = l.whatsappChats[0]; const st = chat ? estado.get(chat.id) : null;
            const q = l.orders[0]?.createdAt || null;
            const humano = chat ? humanos.get(chat.id) || null : null;
            const enviado = presupuestoFueEnviado({ quoteCreatedAt: q, pdfEnviadoAt: pdfs.get(l.id) || null, ultimoMensajeHumano: humano });
            const quoteCreatedAt = enviado ? q : null;
            const chatLabels = st ? st.chatLabels : [];
            const { stage, escalonCubierto, cubiertoHasta } = classifyLead({ quoteCreatedAt, hasPrescription: l.prescriptions.length > 0, chatLabels, tagNames: l.tags.map(t => t.name), ultimoMensajeHumano: humano, now });
            const accion = proximaAccion({ stage, escalonCubierto, cubiertoHasta, hasPrescription: l.prescriptions.length > 0, visitoElLocal: l.interactions.length > 0, quoteCreatedAt, borradorSinEnviar: q && !enviado ? q : null, createdAt: l.createdAt, tieneChat: !!chat, chatLabels, now });
            if (accion.vencida && accion.tipo === 'plantilla') paraHoy.push({ lead: l, chat, st, accion, stage, proximaAccion: accion });
        }
        const ordenados = ordenarPorUrgencia(paraHoy);
        const cupo = Math.min(Math.max(0, CUPO_DIARIO_POR_DEFECTO - enviadosHoy.length), LOTE_POR_TICK);
        let elegidos = 0;
        for (const x of ordenados) {
            const cand = { leadId: x.lead.id, nombre: x.lead.name, createdAt: x.lead.createdAt, waChatId: x.chat?.id || null, plantilla: x.accion.plantilla };
            const veto = evaluar(cand, x.st, { now });
            if (veto) { if (hora === HORA_HASTA - 1) vetosHoy.set(veto, (vetosHoy.get(veto) || 0) + 1); continue; }
            if (elegidos >= cupo) { if (hora === HORA_HASTA - 1) esperaHoy++; continue; }
            elegidos++;
            enviadosHoy.push({ hora, nombre: x.lead.name.trim(), plantilla: x.accion.plantilla, etapa: x.stage });
            // como si hubiera salido
            x.st.chatLabels.push(ETIQUETA_POR_PLANTILLA[x.accion.plantilla]);
            x.st.lastFollowUpAt = new Date(now); x.st.lastOutboundAt = new Date(now);
        }
    }
    const fecha = new Date(primerDia.getTime() + d * D).toISOString().slice(0, 10);
    const porPlantilla = {}; for (const e of enviadosHoy) porPlantilla[e.plantilla] = (porPlantilla[e.plantilla] || 0) + 1;
    resumen.push({ fecha, enviados: enviadosHoy.length, porPlantilla, espera: esperaHoy });
    lineas.push(`## ${fecha} — ${enviadosHoy.length} envíos (${Object.entries(porPlantilla).map(([k, v]) => `${k}: ${v}`).join(', ') || 'ninguno'})${esperaHoy ? ` · ${esperaHoy} quedan para el día siguiente` : ''}`, '');
    if (vetosHoy.size) lineas.push(`Vetados al cierre del día: ${[...vetosHoy.entries()].map(([m, n]) => `${n} × ${m}`).join(' · ')}`, '');
    lineas.push('| Hora | Persona | Mensaje | Estado |', '|---|---|---|---|');
    for (const e of enviadosHoy) lineas.push(`| ${e.hora}:00 | ${e.nombre} | ${e.plantilla} | ${e.etapa} |`);
    lineas.push('');
}
const salida = args.salida || `simulacion-embudo-${DIAS}d.md`;
writeFileSync(salida, lineas.join('\n'));
console.log('Leads:', leads.length);
for (const r of resumen) console.log(`  ${r.fecha}: ${String(r.enviados).padStart(3)} envíos${r.espera ? ` (+${r.espera} esperan)` : ''}  ${Object.entries(r.porPlantilla).map(([k, v]) => k.replace('seguimiento_', '').replace('invitacion_local_v4', 'local').replace('ultimo_seguimiento', 'ultimo') + '=' + v).join(' ')}`);
console.log('Detalle completo en', salida);
