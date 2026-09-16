/**
 * ¿A qué clientes NO les llegó la confirmación de compra?
 *
 * SOLO LECTURA. Recorre las VENTAS y, para cada una, busca la nota que
 * `sendSaleConfirmation` deja SIEMPRE en la ficha del cliente
 * (`src/lib/sale-confirmation.ts`), con el resultado real de cada canal:
 *
 *     📧 Confirmación de compra enviada al cliente · #XXXX (vN)
 *     Email: ✅ enviado a … / ❌ NO se pudo enviar / — sin email cargado
 *     WhatsApp: ✅ enviado al … / ❌ NO se pudo enviar / — sin teléfono válido
 *
 * Sin esa nota, la confirmación ni siquiera se intentó (o reventó antes de
 * mandar nada); con la nota y los dos canales en ❌/— , se intentó y no llegó.
 * Las dos cosas son "el cliente no la recibió", pero se arreglan distinto, así
 * que se cuentan por separado.
 *
 * Uso:
 *   node scripts/checks/confirmaciones-enviadas.mjs           (base local)
 *   node scripts/checks/confirmaciones-enviadas.mjs --prod    (producción, solo lee)
 *   … --desde 2026-08-13   (por defecto: el día que se lanzó la confirmación)
 *   … --detalle            (lista pedido por pedido)
 */
import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const usarProd = argv.includes('--prod');
const verDetalle = argv.includes('--detalle');
const desdeArg = (() => {
    const i = argv.indexOf('--desde');
    return i >= 0 && argv[i + 1] ? argv[i + 1] : '2026-08-13'; // día del lanzamiento
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
console.log(`Ventas confirmadas desde ${desdeArg}\n`);

const prisma = new PrismaClient({ datasourceUrl: url });

const MARCA = '📧 Confirmación de compra enviada al cliente';
const desde = new Date(`${desdeArg}T00:00:00.000Z`);

// Contra producción hay que pedir SELECT explícito (el schema local va
// adelantado y devolver la fila entera revienta).
const ventas = await prisma.order.findMany({
    where: {
        orderType: { in: ['SALE', 'MAYORISTA'] },
        // Un presupuesto viejo confirmado como venta DESPUÉS del corte también
        // tenía que recibir la confirmación: se mira la fecha de creación O la
        // de envío a fábrica, que es cuando se dispara.
        OR: [{ createdAt: { gte: desde } }, { labSentAt: { gte: desde } }],
    },
    select: {
        id: true,
        createdAt: true,
        labSentAt: true,
        labSentBy: true,
        total: true,
        clientId: true,
        client: { select: { id: true, name: true, email: true, phone: true } },
    },
    orderBy: { createdAt: 'asc' },
});

// Todas las notas de confirmación de esos clientes, de una sola consulta.
const clientIds = [...new Set(ventas.map((v) => v.clientId).filter(Boolean))];
const notas = clientIds.length
    ? await prisma.interaction.findMany({
          where: { clientId: { in: clientIds }, content: { startsWith: MARCA } },
          select: { clientId: true, content: true, createdAt: true },
      })
    : [];

// Se indexan por pedido: el sello lleva los últimos 4 del id en mayúscula.
const porPedido = new Map();
for (const n of notas) {
    const m = n.content.match(/·\s*#([0-9A-Z]{4})/);
    if (!m) continue;
    const clave = `${n.clientId}|${m[1]}`;
    if (!porPedido.has(clave)) porPedido.set(clave, []);
    porPedido.get(clave).push(n);
}

const estadoDeCanal = (contenido, etiqueta) => {
    const linea = contenido.split('\n').find((l) => l.startsWith(`${etiqueta}:`)) || '';
    if (linea.includes('✅')) return 'ok';
    if (linea.includes('❌')) return 'fallo';
    return 'sin-dato'; // "— sin email cargado" / "— sin teléfono válido"
};

// ── El cruce que importa: ¿existe el mensaje de verdad? ─────────────────────
// La nota dice "WhatsApp ✅" con lo que contestó el wa-service, no con lo que
// quedó en la conversación. El 16/9/2026 aparecieron 5 ventas de septiembre
// marcadas como enviadas sin un solo mensaje saliente en la ficha: el ✅ no es
// prueba. Se cruza contra los mensajes SALIENTES que mencionan el nº de pedido
// (sirve tanto para el texto libre como para la plantilla `venta_confirmada`,
// que también lo lleva).
const salientes = await prisma.whatsAppMessage.findMany({
    where: { direction: 'OUTBOUND', createdAt: { gte: desde } },
    select: { content: true, status: true },
});
const pedidosEnWhatsApp = new Set();
for (const m of salientes) {
    for (const x of (m.content || '').matchAll(/#([0-9A-Z]{4})\b/g)) pedidosEnWhatsApp.add(x[1]);
}

const grupos = { llego: [], falloTodo: [], sinNota: [], sinContacto: [], falsoOk: [] };

for (const v of ventas) {
    const corto = String(v.id).slice(-4).toUpperCase();
    const intentos = porPedido.get(`${v.clientId}|${corto}`) || [];

    const tieneEmail = !!(v.client?.email || '').trim();
    const tieneTel = (v.client?.phone || '').replace(/\D/g, '').length >= 10;

    if (!intentos.length) {
        (tieneEmail || tieneTel ? grupos.sinNota : grupos.sinContacto).push({ v, motivo: 'sin nota' });
        continue;
    }

    // Alcanza con que UNA versión haya salido por algún canal.
    const algunoSalio = intentos.some(
        (n) => estadoDeCanal(n.content, 'Email') === 'ok' || estadoDeCanal(n.content, 'WhatsApp') === 'ok',
    );
    // Nota que canta WhatsApp ✅ pero el mensaje no existe en la conversación.
    const dijoWaOk = intentos.some(
        (n) => estadoDeCanal(n.content, 'WhatsApp') === 'ok',
    );
    if (dijoWaOk && !pedidosEnWhatsApp.has(corto)) {
        grupos.falsoOk.push({ v, motivo: 'la ficha dice ✅ pero no hay mensaje en la conversación' });
    }

    if (algunoSalio) {
        // Que "algún canal" haya salido no alcanza para dormir tranquilo: el
        // mail se lee poco y el repaso se contesta por WhatsApp. Se guarda el
        // desglose para poder mirar los que solo salieron por mail.
        const ultimaOk = intentos[intentos.length - 1];
        grupos.llego.push({
            v,
            email: estadoDeCanal(ultimaOk.content, 'Email'),
            wa: estadoDeCanal(ultimaOk.content, 'WhatsApp'),
        });
    } else {
        const ultima = intentos[intentos.length - 1];
        const email = estadoDeCanal(ultima.content, 'Email');
        const wa = estadoDeCanal(ultima.content, 'WhatsApp');
        const motivo =
            email === 'sin-dato' && wa === 'sin-dato'
                ? 'sin email ni teléfono cargados'
                : `email: ${email} · whatsapp: ${wa}`;
        (email === 'sin-dato' && wa === 'sin-dato' ? grupos.sinContacto : grupos.falloTodo).push({ v, motivo });
    }
}

const pct = (n) => (ventas.length ? ((n / ventas.length) * 100).toFixed(1) : '0.0');
const linea = ({ v, motivo }) =>
    `  #${String(v.id).slice(-4).toUpperCase()}  ${v.createdAt.toISOString().slice(0, 10)}  ` +
    `${(v.client?.name || 'sin cliente').padEnd(28).slice(0, 28)}  ` +
    `$${Math.round(v.total || 0).toLocaleString('es-AR').padStart(10)}  ` +
    `tel:${(v.client?.phone || '—').padEnd(14).slice(0, 14)} mail:${v.client?.email ? 'sí' : 'NO '}` +
    (motivo ? `  ${motivo}` : '');

console.log(`Ventas en el período: ${ventas.length}`);
console.log(`  ✅ la recibieron (algún canal):   ${grupos.llego.length} (${pct(grupos.llego.length)}%)`);
console.log(`  ❌ se intentó y NO llegó:         ${grupos.falloTodo.length} (${pct(grupos.falloTodo.length)}%)`);
console.log(`  ⚠️  NUNCA se intentó (sin nota):   ${grupos.sinNota.length} (${pct(grupos.sinNota.length)}%)`);
console.log(`  📵 sin email ni teléfono:         ${grupos.sinContacto.length} (${pct(grupos.sinContacto.length)}%)`);
console.log(`  🚨 la ficha miente (✅ sin mensaje): ${grupos.falsoOk.length} (${pct(grupos.falsoOk.length)}%)`);

// Desglose de los que "llegaron": el WhatsApp es el canal que el cliente
// realmente lee y contesta.
const soloMail = grupos.llego.filter((x) => x.wa !== 'ok');
console.log(`\n   de los que llegaron, SIN WhatsApp (solo mail): ${soloMail.length}`);
console.log(`   con WhatsApp OK:                              ${grupos.llego.length - soloMail.length}`);

const noRecibieron = grupos.falloTodo.length + grupos.sinNota.length + grupos.sinContacto.length;
console.log(`\n👉 NO la recibieron: ${noRecibieron} de ${ventas.length} ventas (${pct(noRecibieron)}%)`);

if (verDetalle) {
    for (const [titulo, lista] of [
        ['NUNCA SE INTENTÓ (no hay nota en la ficha)', grupos.sinNota],
        ['SE INTENTÓ Y NO LLEGÓ POR NINGÚN CANAL', grupos.falloTodo],
        ['SIN EMAIL NI TELÉFONO CARGADOS', grupos.sinContacto],
        ['LA FICHA DICE ✅ PERO NO HAY MENSAJE EN LA CONVERSACIÓN', grupos.falsoOk],
        ['LLEGÓ SOLO POR MAIL (el WhatsApp no salió)', soloMail.map((x) => ({ v: x.v, motivo: `whatsapp: ${x.wa}` }))],
    ]) {
        if (!lista.length) continue;
        console.log(`\n── ${titulo} (${lista.length}) ──`);
        lista.forEach((x) => console.log(linea(x)));
    }
}

await prisma.$disconnect();
