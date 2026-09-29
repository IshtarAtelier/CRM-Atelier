// ────────────────────────────────────────────────────────────────────────────
// SALDOS PENDIENTES: cuadro de todas las ventas con saldo, por antigüedad.
//
// El saldo sale de PricingService.calculateOrderFinancials — NUNCA de
// total − paid (esa resta inventó 76 saldos fantasma en producción).
// "Días" = desde que la venta se pasó a fábrica (labSentAt), que es la fecha
// de pase a venta que usa /admin/ventas.
//
// Además dice si los avisos automáticos de cobro están prendidos DE VERDAD:
// lee el interruptor y las últimas filas que cada aviso dejó en la base.
//
// Solo lectura. Escribe el email en HTML en --out (o en el scratchpad).
// Correr contra producción:
//   node --env-file=.env --experimental-strip-types --import ./scripts/checks/_alias.mjs \
//        scripts/checks/saldos-pendientes.check.mjs --prod [--out archivo.html]
// ────────────────────────────────────────────────────────────────────────────

import { writeFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { PricingService } from '@/services/PricingService';
import { formatearPrecio } from '@/lib/format-precio';
import { formatDate } from '@/lib/format-date';

const args = process.argv.slice(2);
const prod = args.includes('--prod');
const outIdx = args.indexOf('--out');
const outPath = outIdx >= 0 ? args[outIdx + 1] : null;

const url = prod ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) { console.error(`Falta ${prod ? 'PROD_DATABASE_URL' : 'DATABASE_URL'} en .env`); process.exit(1); }
const prisma = new PrismaClient({ datasources: { db: { url } } });
const APP = process.env.NEXT_PUBLIC_APP_URL || 'https://crm-atelier-production-ae72.up.railway.app';

const ETIQUETA = {
    NONE: 'Pendiente',
    SENT: 'Falta procesar',
    IN_PROGRESS: 'Procesado',
    FINISHED: 'Listo para retirar',
    READY: 'Listo para retirar',
    DELIVERED: 'Entregado · a cobrar',
};
const LISTOS = new Set(['FINISHED', 'READY', 'DELIVERED']);

const ahora = Date.now();
const dias = (d) => d ? Math.floor((ahora - new Date(d).getTime()) / 86400000) : null;

// Select explícito: el schema local está adelantado y traer la fila entera
// revienta contra producción.
const ventas = await prisma.order.findMany({
    where: { isDeleted: false, orderType: 'SALE' },
    select: {
        id: true, total: true, paid: true, subtotalWithMarkup: true, specialDiscount: true,
        discountCash: true, discountTransfer: true,
        labStatus: true, labSentAt: true, labSentBy: true, createdAt: true,
        client: { select: { id: true, name: true } },
        payments: { select: { amount: true, method: true, date: true, createdByName: true }, orderBy: { date: 'asc' } },
    },
});

// --detalle: cada venta con saldo, con sus pagos uno por uno, para ver de
// dónde sale el número antes de reclamarlo.
if (args.includes('--detalle')) {
    const p = (n) => formatearPrecio(n);
    const lista = ventas.map(o => ({ o, f: PricingService.calculateOrderFinancials(o) })).filter(x => x.f.hasBalance)
        .sort((a, b) => new Date(a.o.labSentAt || 0) - new Date(b.o.labSentAt || 0));
    for (const { o, f } of lista) {
        console.log(`\n${(o.client?.name || '').trim()} — ${o.labStatus} — pase a venta ${o.labSentAt ? formatDate(o.labSentAt) : '—'} — ${APP}/admin/ventas?id=${o.id}`);
        console.log(`  Lista ${p(f.listPrice)} · efectivo ${p(f.totalCash)} (−${f.discountCash}%) · transf ${p(f.totalTransfer)} (−${f.discountTransfer}%) · campo paid=${p(o.paid)}`);
        if (o.payments.length === 0) console.log('  Pagos: NINGUNO cargado');
        for (const pg of o.payments) console.log(`  Pago ${formatDate(pg.date)} · ${pg.method} · ${p(pg.amount)} · cargó ${pg.createdByName || '?'}`);
        console.log(`  Pagado ${p(f.paidReal)} = ${p(f.listEquivalentPaid)} de lista → SALDO lista ${p(f.remainingList)} · efectivo ${p(f.remainingCash)} · transf ${p(f.remainingTransfer)}`);
    }
}

const conSaldo = ventas
    .map(o => ({ o, f: PricingService.calculateOrderFinancials(o) }))
    .filter(({ f }) => f.hasBalance)
    .map(({ o, f }) => ({
        id: o.id,
        cliente: o.client?.name || '(sin nombre)',
        clienteId: o.client?.id,
        estado: o.labStatus || 'NONE',
        etiqueta: ETIQUETA[o.labStatus || 'NONE'] || o.labStatus,
        listo: LISTOS.has(o.labStatus || 'NONE'),
        labSentAt: o.labSentAt,
        dias: dias(o.labSentAt),
        vendedor: o.labSentBy || '—',
        saldoLista: f.remainingList,
        saldoEfectivo: f.remainingCash,
        saldoTransfer: f.remainingTransfer,
    }));

// Más antiguo primero; sin fecha de pase a venta, al final.
const porAntiguedad = (a, b) => {
    if (a.labSentAt && b.labSentAt) return new Date(a.labSentAt) - new Date(b.labSentAt);
    if (a.labSentAt) return -1;
    if (b.labSentAt) return 1;
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
};
const listos = conSaldo.filter(v => v.listo).sort(porAntiguedad);
const noListos = conSaldo.filter(v => !v.listo).sort(porAntiguedad);
const suma = (arr, k) => arr.reduce((s, v) => s + v[k], 0);

// ── Estado real de los avisos automáticos ──────────────────────────────────
const settings = await prisma.systemSetting.findMany({
    where: { OR: [{ key: { contains: 'saldo' } }, { key: 'followups_enabled' }] },
    select: { key: true, value: true },
});
const ultimaNotif = async (type) => {
    const [n, last] = await Promise.all([
        prisma.notification.count({ where: { type } }),
        prisma.notification.findFirst({ where: { type }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ]);
    return { n, last: last?.createdAt || null };
};
const ultimoTemplate = async (where) => {
    const [n, last] = await Promise.all([
        prisma.whatsAppMessage.count({ where }),
        prisma.whatsAppMessage.findFirst({ where, orderBy: { createdAt: 'desc' }, select: { createdAt: true, status: true } }),
    ]);
    return { n, last: last?.createdAt || null, status: last?.status || null };
};
const avisos = {
    settings,
    recordatorioSaldoWa: await ultimoTemplate({ templateName: 'recordatorio_saldo' }),
    pedidoListoSaldoWa: await ultimoTemplate({ templateName: { startsWith: 'pedido_listo_saldo' } }),
    pedidoListoSaldoMail: await ultimaNotif('PEDIDO_LISTO_SALDO_AVISADO'),
    saldoVencidoMail: await ultimaNotif('BALANCE_OVERDUE'),
};
await prisma.$disconnect();

// ── Consola ────────────────────────────────────────────────────────────────
const fila = (v) => ({
    Cliente: v.cliente,
    'Saldo lista': formatearPrecio(v.saldoLista),
    'Saldo efvo': formatearPrecio(v.saldoEfectivo),
    Estado: v.etiqueta,
    Días: v.dias ?? '—',
    'Pase a venta': v.labSentAt ? formatDate(v.labSentAt) : '—',
    Vendedor: v.vendedor,
});
console.log(`\nBase: ${prod ? 'PRODUCCIÓN' : 'local'} · ventas con saldo: ${conSaldo.length}\n`);
console.log(`LISTOS / ENTREGADOS (${listos.length}) — lista ${formatearPrecio(suma(listos, 'saldoLista'))} · efectivo ${formatearPrecio(suma(listos, 'saldoEfectivo'))}`);
console.table(listos.map(fila));
console.log(`NO LISTOS (${noListos.length}) — lista ${formatearPrecio(suma(noListos, 'saldoLista'))} · efectivo ${formatearPrecio(suma(noListos, 'saldoEfectivo'))}`);
console.table(noListos.map(fila));
console.log('AVISOS AUTOMÁTICOS DE COBRO');
console.log(JSON.stringify(avisos, null, 2));

// ── Email HTML ─────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const td = 'padding:8px 10px;border-bottom:1px solid #e5e5e5;font-size:14px;';
const th = 'padding:8px 10px;border-bottom:2px solid #c8a55c;font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#666;text-align:left;';
const tabla = (titulo, filas) => filas.length === 0
    ? `<h2 style="font-size:17px;margin:28px 0 8px;">${titulo} (0)</h2><p style="color:#666;">Ninguna.</p>`
    : `<h2 style="font-size:17px;margin:28px 0 8px;">${titulo} (${filas.length})</h2>
<table style="width:100%;border-collapse:collapse;">
<tr><th style="${th}">Cliente</th><th style="${th};text-align:right">Saldo lista</th><th style="${th};text-align:right">Saldo efectivo</th><th style="${th}">Estado</th><th style="${th};text-align:right">Días</th><th style="${th}">Pase a venta</th><th style="${th}">Vendedor</th></tr>
${filas.map(v => `<tr>
<td style="${td}"><a href="${APP}/admin/ventas?id=${v.id}" style="color:#8a6d3b;">${esc(v.cliente)}</a></td>
<td style="${td};text-align:right;font-weight:bold;">${formatearPrecio(v.saldoLista)}</td>
<td style="${td};text-align:right;">${formatearPrecio(v.saldoEfectivo)}</td>
<td style="${td}">${esc(v.etiqueta)}</td>
<td style="${td};text-align:right;">${v.dias ?? '—'}</td>
<td style="${td}">${v.labSentAt ? formatDate(v.labSentAt) : '—'}</td>
<td style="${td}">${esc(v.vendedor)}</td>
</tr>`).join('\n')}
<tr><td style="${td};font-weight:bold;">Total</td><td style="${td};text-align:right;font-weight:bold;">${formatearPrecio(suma(filas, 'saldoLista'))}</td><td style="${td};text-align:right;font-weight:bold;">${formatearPrecio(suma(filas, 'saldoEfectivo'))}</td><td style="${td}" colspan="4"></td></tr>
</table>`;

const modo = settings.find(s => s.key === 'recordatorio_saldo_modo')?.value;
const fecha = (d) => d ? formatDate(d) : 'nunca';
const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Saldos pendientes</title></head>
<body style="margin:0;padding:24px;background:#fff;color:#222;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:960px;margin:0 auto;">
<h1 style="font-size:22px;margin:0 0 4px;">Saldos pendientes al ${formatDate(new Date())}</h1>
<p style="margin:0 0 16px;color:#666;font-size:13px;">${conSaldo.length} ventas con saldo · ordenadas de la más antigua a la más nueva · "Días" cuenta desde que la venta se pasó a fábrica.</p>
<p style="margin:0 0 4px;font-size:14px;"><strong>Total a cobrar (precio de lista):</strong> ${formatearPrecio(suma(conSaldo, 'saldoLista'))} — si todos pagan en efectivo: ${formatearPrecio(suma(conSaldo, 'saldoEfectivo'))}</p>
${tabla('Listos para retirar o entregados', listos)}
${tabla('Todavía no listos', noListos)}
<h2 style="font-size:17px;margin:28px 0 8px;">Avisos automáticos de cobro</h2>
<ul style="font-size:14px;line-height:1.6;padding-left:20px;">
<li><strong>Recordatorio de saldo por WhatsApp al cliente</strong> (pedido listo hace 7+ días): interruptor <code>recordatorio_saldo_modo</code> = <strong>${esc(modo || 'sin definir → seco')}</strong>. Enviados: ${avisos.recordatorioSaldoWa.n} (último: ${fecha(avisos.recordatorioSaldoWa.last)}).</li>
<li><strong>Aviso "pedido listo + saldo" por WhatsApp al cliente</strong>: ${avisos.pedidoListoSaldoWa.n} enviados (último: ${fecha(avisos.pedidoListoSaldoWa.last)}${avisos.pedidoListoSaldoWa.status ? ', ' + esc(avisos.pedidoListoSaldoWa.status) : ''}).</li>
<li><strong>Mail interno "pedidos listos con saldo"</strong>: ${avisos.pedidoListoSaldoMail.n} avisos (último: ${fecha(avisos.pedidoListoSaldoMail.last)}).</li>
<li><strong>Mail interno de saldos vencidos</strong>: ${avisos.saldoVencidoMail.n} avisos (último: ${fecha(avisos.saldoVencidoMail.last)}).</li>
</ul>
</div></body></html>`;

const destino = outPath || `${process.env.SALDOS_OUT_DIR || '.'}/saldos-pendientes-${new Date().toISOString().slice(0, 10)}.html`;
writeFileSync(destino, html);
console.log(`\nEmail HTML: ${destino}`);
