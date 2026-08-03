#!/usr/bin/env node
/**
 * ROAS real por anuncio: gasto de Meta ↔ ventas del CRM.
 *
 * El puente es la etiqueta del anuncio. Los anuncios de Meta se llaman
 * "[metaFlor]", "[MetaAgos]", etc., y el texto pre-cargado que llega por
 * WhatsApp trae esa misma etiqueta entre corchetes. Con eso se sabe qué
 * anuncio trajo cada conversación, y de ahí qué facturó.
 *
 * Suma las DOS cuentas publicitarias (la de pesos y la de dólares); el gasto
 * en USD se convierte con el blue del día.
 *
 * Uso:
 *   node scripts/ads/roas_real.js [días]        (por defecto 30, lee la DB local)
 *   node scripts/ads/roas_real.js 30 --prod     (lee la base de producción)
 */

const { PrismaClient } = require('@prisma/client');

const CUENTAS = ['act_901723834933651', 'act_2107444353167176'];
const API = 'https://graph.facebook.com/v24.0';

const dias = Number(process.argv.find(a => /^\d+$/.test(a)) || 30);
const usarProd = process.argv.includes('--prod');
const TOKEN = process.env.META_ADS_TOKEN;

/** Saca la etiqueta de un texto: "[metaFlor]" o "... [metaAgos]" → "metaflor" */
// Parser único (wa-service/shared/ad-tag.js). Acá había una quinta copia del
// regex, con el juego de caracteres restringido: no leía igual que la ingestión.
const { parseAdTag } = require('../../wa-service/shared/ad-tag');
function etiqueta(txt) {
  return parseAdTag(txt)?.campaign ?? null;
}

/** Etiqueta implícita para anuncios sin corchetes, por producto mencionado. */
function etiquetaImplicita(txt) {
  const t = String(txt || '').toLowerCase();
  if (/mayolens/.test(t)) return 'myolens';
  if (/myofix/.test(t)) return 'myofix';
  if (/clipon|clip-on|clipones|clippons/.test(t)) return 'clip';
  if (/remarketing|2x1/.test(t)) return 'remarketing2x1';
  return null;
}

const clave = (txt) => etiqueta(txt) || etiquetaImplicita(txt);

async function blue() {
  try {
    const r = await fetch('https://mercados.ambito.com/dolar/informal/variacion');
    const j = await r.json();
    return Number(String(j.venta).replace('.', '').replace(',', '.')) || 1570;
  } catch { return 1570; }
}

async function gastoPorEtiqueta(rate) {
  const acc = {};
  for (const cuenta of CUENTAS) {
    const url = new URL(`${API}/${cuenta}/insights`);
    url.searchParams.set('level', 'ad');
    url.searchParams.set('fields', 'ad_name,spend,actions,account_currency');
    url.searchParams.set('limit', '200');
    url.searchParams.set('time_range', JSON.stringify({
      since: new Date(Date.now() - dias * 864e5).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }),
      until: new Date(Date.now() - 864e5).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }),
    }));
    url.searchParams.set('access_token', TOKEN);

    const j = await (await fetch(url)).json();
    if (j.error) { console.error(`Meta (${cuenta}): ${j.error.message}`); continue; }

    for (const r of j.data || []) {
      const k = clave(r.ad_name);
      if (!k) continue;
      const enPesos = r.account_currency === 'USD' ? Number(r.spend) * rate : Number(r.spend);
      const conv = (r.actions || [])
        .filter(a => a.action_type.includes('messaging_conversation_started'))
        .reduce((s, a) => s + Number(a.value), 0);
      (acc[k] ||= { gasto: 0, convMeta: 0 });
      acc[k].gasto += enPesos;
      acc[k].convMeta += conv;
    }
  }
  return acc;
}

async function ventasPorEtiqueta(prisma) {
  const desde = new Date(Date.now() - dias * 864e5);
  const chats = await prisma.whatsAppChat.findMany({
    where: { createdAt: { gte: desde } },
    select: {
      clientId: true,
      adTag: true,
      messages: { where: { direction: 'INBOUND' }, orderBy: { createdAt: 'asc' }, take: 1, select: { content: true } },
    },
  });

  const acc = {};
  for (const c of chats) {
    // La columna persistida en la ingestión manda; el parseo del primer mensaje
    // queda como respaldo (chats previos a la columna o etiquetas por producto).
    const k = c.adTag || clave(c.messages[0]?.content);
    if (!k) continue;
    (acc[k] ||= { chats: 0, clientes: new Set() });
    acc[k].chats++;
    if (c.clientId) acc[k].clientes.add(c.clientId);
  }

  const ids = [...new Set(Object.values(acc).flatMap(g => [...g.clientes]))];
  // Órdenes vivas del período. Acá conviven presupuestos (PDF sin plata) y
  // ventas reales — auditoría 28/7: contar Order.total a secas contaba
  // presupuestos LOST/PENDING como facturación (el falso "70×").
  // Venta REAL = plata cobrada (payments/paid) o pedido en laboratorio.
  const ordenes = ids.length
    ? await prisma.order.findMany({
        where: { clientId: { in: ids }, createdAt: { gte: desde }, isDeleted: false },
        select: {
          clientId: true, total: true, paid: true, labStatus: true, status: true,
          payments: { select: { amount: true } },
        },
      })
    : [];

  const porCliente = {};
  for (const v of ordenes) {
    const p = (porCliente[v.clientId] ||= { presupuesto: 0, real: 0, cobrado: 0, nReales: 0 });
    p.presupuesto += Number(v.total || 0);
    // Solo pagos REGISTRADOS. `Order.paid` no sirve de respaldo: hay filas con
    // paid = total × 1,25 y cero pagos detrás (residuo del arreglo del ratchet),
    // que se colaban como cierres reales.
    const cobrado = v.payments.reduce((s, x) => s + Number(x.amount || 0), 0);
    const esReal = !['LOST', 'CANCELED'].includes(v.status || '') &&
      (cobrado > 0 || (v.labStatus && v.labStatus !== 'NONE'));
    if (esReal) { p.real += Number(v.total || 0); p.cobrado += cobrado; p.nReales++; }
  }

  for (const g of Object.values(acc)) {
    g.presupuestados = 0; g.presupuestado = 0; g.cierres = 0; g.facturadoReal = 0; g.cobrado = 0;
    for (const cid of g.clientes) {
      const v = porCliente[cid];
      if (!v) continue;
      if (v.presupuesto > 0) { g.presupuestados++; g.presupuestado += v.presupuesto; }
      if (v.nReales > 0) { g.cierres++; g.facturadoReal += v.real; g.cobrado += v.cobrado; }
    }
  }
  return acc;
}

(async () => {
  if (!TOKEN) { console.error('Falta META_ADS_TOKEN en el entorno.'); process.exit(1); }

  const prisma = usarProd
    ? new PrismaClient({ datasources: { db: { url: process.env.PROD_DATABASE_URL } } })
    : new PrismaClient();

  const rate = await blue();
  const [gasto, ventas] = await Promise.all([gastoPorEtiqueta(rate), ventasPorEtiqueta(prisma)]);

  const claves = [...new Set([...Object.keys(gasto), ...Object.keys(ventas)])];
  const filas = claves.map(k => {
    const g = gasto[k] || { gasto: 0, convMeta: 0 };
    const v = ventas[k] || { chats: 0, presupuestados: 0, presupuestado: 0, cierres: 0, facturadoReal: 0, cobrado: 0 };
    return {
      k, gasto: g.gasto, convMeta: g.convMeta,
      chats: v.chats, presupuestados: v.presupuestados, presupuestado: v.presupuestado,
      cierres: v.cierres, facturadoReal: v.facturadoReal, cobrado: v.cobrado,
      roas: g.gasto > 0 && v.facturadoReal > 0 ? v.facturadoReal / g.gasto : null,
    };
  }).sort((a, b) => b.facturadoReal - a.facturadoReal || b.presupuestado - a.presupuestado);

  const $ = n => '$' + Math.round(n).toLocaleString('es-AR');
  const pad = (s, n) => String(s).padEnd(n);
  const num = (s, n) => String(s).padStart(n);

  console.log(`\n═══ RETORNO REAL POR ANUNCIO · últimos ${dias} días (dólar $${rate}) ═══`);
  console.log(`    Cierre = venta con plata cobrada o pedido en laboratorio. Presup. = clientes presupuestados.\n`);
  console.log(pad('ANUNCIO', 18) + num('gasto', 11) + num('chats', 7) + num('presup.', 9) + num('cierres', 9) + num('vendió', 13) + num('cobrado', 12) + num('ROAS', 7));
  console.log('─'.repeat(86));

  const T = { gasto: 0, chats: 0, presupuestados: 0, presupuestado: 0, cierres: 0, facturadoReal: 0, cobrado: 0 };
  for (const f of filas) {
    if (!f.gasto && !f.presupuestado && !f.facturadoReal) continue;
    console.log(
      pad(f.k, 18) + num($(f.gasto), 11) + num(f.chats, 7) + num(f.presupuestados || '—', 9) +
      num(f.cierres || '—', 9) + num(f.facturadoReal ? $(f.facturadoReal) : '—', 13) +
      num(f.cobrado ? $(f.cobrado) : '—', 12) + num(f.roas != null ? f.roas.toFixed(1) + 'x' : '—', 7)
    );
    T.gasto += f.gasto; T.chats += f.chats; T.presupuestados += f.presupuestados;
    T.presupuestado += f.presupuestado; T.cierres += f.cierres;
    T.facturadoReal += f.facturadoReal; T.cobrado += f.cobrado;
  }

  console.log('─'.repeat(86));
  console.log(
    pad('TOTAL', 18) + num($(T.gasto), 11) + num(T.chats, 7) + num(T.presupuestados, 9) +
    num(T.cierres, 9) + num($(T.facturadoReal), 13) + num($(T.cobrado), 12) +
    num(T.gasto > 0 && T.facturadoReal > 0 ? (T.facturadoReal / T.gasto).toFixed(1) + 'x' : '—', 7)
  );

  if (T.chats) {
    console.log(`\n  ${T.presupuestados} de ${T.chats} chats recibieron presupuesto (${$(T.presupuestado)} presupuestados).`);
    console.log(`  Cierres REALES: ${T.cierres} (${(T.cierres / T.chats * 100).toFixed(1)}% de los chats) → ${$(T.facturadoReal)} vendido, ${$(T.cobrado)} cobrado.`);
    if (T.facturadoReal > 0 && T.gasto > 0) console.log(`  Por cada peso invertido volvieron ${(T.facturadoReal / T.gasto).toFixed(2)} en ventas reales.`);
  }
  console.log('\n  Atribución: etiqueta persistida en el chat (o parseo del primer mensaje como');
  console.log('  respaldo) + órdenes de ese cliente en la ventana. Venta real exige plata');
  console.log('  cobrada o laboratorio — un presupuesto NO es una venta. No es ganancia.\n');

  await prisma.$disconnect();
})();
