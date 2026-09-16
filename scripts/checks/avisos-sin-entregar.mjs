/**
 * ¿Qué avisos automáticos NO llegaron a la conversación?
 *
 * SOLO LECTURA. Es el espejo del auditor (`src/services/avisos-auditor.service.ts`)
 * para mirar la foto sin mandarle nada a nadie. Revisa los tres avisos que el
 * cliente espera y los da por entregados ÚNICAMENTE si el mensaje existe en la
 * conversación:
 *
 *   1. confirmación de compra
 *   2. pedido procesado (con la fecha estimada de confección)
 *   3. listo para retirar
 *
 * No alcanza con que la ficha diga "✅ enviado": ese ✅ es el HTTP 200 del
 * wa-service, y el 16/9/2026 mintió en 5 ventas de septiembre.
 *
 * Uso:
 *   node scripts/checks/avisos-sin-entregar.mjs           (base local)
 *   node scripts/checks/avisos-sin-entregar.mjs --prod    (producción, solo lee)
 *   … --dias 30      ventana a revisar (default 30)
 *   … --detalle      lista pedido por pedido
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const usarProd = argv.includes('--prod');
const verDetalle = argv.includes('--detalle');
const dias = (() => {
    const i = argv.indexOf('--dias');
    const n = i >= 0 ? parseInt(argv[i + 1], 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 30;
})();

// El .env no se parsea con dotenv a propósito: solo se saca la URL que hace
// falta y nunca se imprime.
const env = Object.fromEntries(
    readFileSync(new URL('../../.env', import.meta.url), 'utf8')
        .split('\n')
        .filter((l) => /^[A-Z_]+=/.test(l))
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).replace(/^["']|["']$/g, '')]),
);
const url = usarProd ? env.PROD_DATABASE_URL : env.DATABASE_URL;
if (!url) {
    console.error(`No encontré ${usarProd ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en .env`);
    process.exit(1);
}
console.log(`Base: ${usarProd ? 'PRODUCCIÓN' : 'local'} (${url.replace(/:\/\/[^@]*@/, '://***@').split('?')[0]})`);
console.log(`Ventana: últimos ${dias} días\n`);

const prisma = new PrismaClient({ datasourceUrl: url });

// Mismas huellas y márgenes que el auditor. Si cambian allá, cambian acá.
const GRACIA_MINUTOS = 90;
const ESTADOS_PROCESADO = ['IN_PROGRESS', 'FINISHED', 'READY', 'DELIVERED'];
const ESTADOS_LISTO = ['READY', 'DELIVERED'];
const HUELLAS = {
    confirmacion_compra: { etiqueta: 'confirmación de compra', frases: ['Confirmación de compra — Pedido'], plantillas: ['venta_confirmada'] },
    procesado: { etiqueta: 'procesado (fecha estimada)', frases: ['tu pedido ya fue procesado', 'Fecha aproximada de entrega'], plantillas: ['estado_pedido'] },
    listo_para_retirar: { etiqueta: 'listo para retirar', frases: ['listos esperándote', 'listo para retirar', 'ya están listos'], plantillas: ['pedido_listo', 'pedido_listo_saldo'] },
};
const esElAviso = (msg, tipo) => {
    const h = HUELLAS[tipo];
    if (msg.templateName && h.plantillas.some((p) => msg.templateName.startsWith(p))) return true;
    return h.frases.some((f) => (msg.content || '').includes(f));
};

const desde = new Date(Date.now() - dias * 86400000);
const corte = new Date(Date.now() - GRACIA_MINUTOS * 60000);

const ventas = await prisma.order.findMany({
    where: {
        orderType: { in: ['SALE', 'MAYORISTA'] },
        OR: [{ createdAt: { gte: desde } }, { labSentAt: { gte: desde } }, { updatedAt: { gte: desde } }],
    },
    select: {
        id: true, createdAt: true, updatedAt: true, labSentAt: true, labStatus: true, clientId: true,
        client: { select: { name: true, phone: true, email: true } },
    },
    orderBy: { createdAt: 'asc' },
});


// Los salientes se indexan por DOS llaves: la ficha (clientId del chat) y los
// últimos 8 dígitos del teléfono. Con una sola no alcanza: 821 de los 2.395
// chats no tienen ficha vinculada, y el teléfono de la ficha y el waId del chat
// no siempre están escritos igual (uno con 549 adelante y el otro sin). Cruzar
// por una sola llave daba 189 avisos "sin llegar" que en realidad estaban.
const sufijo = (t) => {
    const d = String(t || '').replace(/\D/g, '');
    return d.length >= 8 ? d.slice(-8) : null;
};

const salientes = await prisma.whatsAppMessage.findMany({
    where: { direction: 'OUTBOUND', createdAt: { gte: desde } },
    select: { content: true, templateName: true, createdAt: true, chat: { select: { clientId: true, waId: true, realPhone: true } } },
});

// Tercera llave, la más fuerte: el NÚMERO DE PEDIDO que el propio mensaje
// menciona (#A7J9). No depende de con qué chat quedó asociado, y es la única
// que encuentra los mensajes de un chat @lid o de un número que la ficha ya no
// tiene. Sin ella el cruce acusaba 43 confirmaciones perdidas que sí existen.
const porLlave = new Map();
const guardar = (k, m) => { if (!k) return; if (!porLlave.has(k)) porLlave.set(k, []); porLlave.get(k).push(m); };
for (const m of salientes) {
    guardar(m.chat?.clientId, m);
    guardar(sufijo(m.chat?.waId), m);
    guardar(sufijo(m.chat?.realPhone), m);
    for (const x of (m.content || '').matchAll(/#([0-9A-Z]{4})\b/g)) guardar(`nro:${x[1]}`, m);
}

// ¿CUÁNDO pasó cada pedido a Procesado y a Listo? No hay columna con esa fecha,
// y `updatedAt` es la última modificación de cualquier cosa: usarlo daba 83
// falsos "no llegó" en pedidos ya entregados —el aviso había salido días antes
// de ese updatedAt—. La fecha real está en la nota que deja el propio cambio de
// estado en la ficha.
const cambios = await prisma.interaction.findMany({
    where: { createdAt: { gte: desde }, content: { startsWith: '📦 ' }, type: 'SISTEMA' },
    select: { content: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
});
const hitoProcesado = new Map();
const hitoListo = new Map();
for (const c of cambios) {
    const m = c.content.match(/pedido #([0-9A-Z]{4}):.*→ (.+)$/);
    if (!m) continue;
    const [, nro, destino] = m;
    if (destino.startsWith('Procesado') && !hitoProcesado.has(nro)) hitoProcesado.set(nro, c.createdAt);
    if (destino.startsWith('Listo para retirar') && !hitoListo.has(nro)) hitoListo.set(nro, c.createdAt);
}

const faltantes = [];
const esperadosPorTipo = { confirmacion_compra: 0, procesado: 0, listo_para_retirar: 0 };

for (const v of ventas) {
    const mensajes = [
        ...(porLlave.get(v.clientId) || []),
        ...(porLlave.get(sufijo(v.client?.phone)) || []),
        ...(porLlave.get(`nro:${String(v.id).slice(-4).toUpperCase()}`) || []),
    ];

    const nro = String(v.id).slice(-4).toUpperCase();
    const esperados = [];
    if (v.labSentAt) esperados.push(['confirmacion_compra', v.labSentAt]);
    // Sin fecha del cambio de estado no se audita: no se puede saber si el aviso
    // salió antes o después, y en la duda no se le vuelve a escribir al cliente.
    const procesadoEl = hitoProcesado.get(nro) || (ESTADOS_PROCESADO.includes(v.labStatus) ? v.labSentAt : null);
    if (ESTADOS_PROCESADO.includes(v.labStatus) && procesadoEl) esperados.push(['procesado', procesadoEl]);
    const listoEl = hitoListo.get(nro);
    if (ESTADOS_LISTO.includes(v.labStatus) && listoEl) esperados.push(['listo_para_retirar', listoEl]);

    for (const [tipo, hito] of esperados) {
        if (hito > corte) continue; // todavía puede estar en camino
        // Y el hito tiene que caer DENTRO de la ventana: los mensajes se leen de
        // los últimos `dias`, así que un pedido viejo que se tocó ayer parecería
        // no haber recibido nunca su aviso — el mensaje existe, está fuera de la
        // ventana. Así se acusaban 41 confirmaciones perdidas que sí salieron.
        if (hito < desde) continue;
        esperadosPorTipo[tipo]++;
        if (mensajes.some((m) => m.createdAt >= hito && esElAviso(m, tipo))) continue;
        faltantes.push({ v, tipo, hito });
    }
}

console.log(`Ventas revisadas: ${ventas.length}`);
for (const [tipo, h] of Object.entries(HUELLAS)) {
    const faltan = faltantes.filter((f) => f.tipo === tipo).length;
    const esperados = esperadosPorTipo[tipo];
    const pct = esperados ? ((faltan / esperados) * 100).toFixed(1) : '0.0';
    console.log(`  ${h.etiqueta.padEnd(28)} correspondían ${String(esperados).padStart(4)} · SIN LLEGAR ${String(faltan).padStart(3)} (${pct}%)`);
}
console.log(`\n👉 Avisos que nunca llegaron a la conversación: ${faltantes.length}`);

if (verDetalle && faltantes.length) {
    for (const [tipo, h] of Object.entries(HUELLAS)) {
        const lista = faltantes.filter((f) => f.tipo === tipo);
        if (!lista.length) continue;
        console.log(`\n── ${h.etiqueta.toUpperCase()} (${lista.length}) ──`);
        for (const { v, hito } of lista) {
            console.log(
                `  #${String(v.id).slice(-4).toUpperCase()}  desde ${hito.toISOString().slice(0, 10)}  ` +
                `${(v.client?.name || 'sin cliente').padEnd(28).slice(0, 28)}  ` +
                `estado:${(v.labStatus || '—').padEnd(12)} tel:${(v.client?.phone || '—').padEnd(14).slice(0, 14)} mail:${v.client?.email ? 'sí' : 'NO'}`,
            );
        }
    }
}

await prisma.$disconnect();
