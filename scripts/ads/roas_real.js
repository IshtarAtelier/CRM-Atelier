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
function etiqueta(txt) {
  if (!txt) return null;
  const m = String(txt).match(/\[\s*meta([a-z0-9_ -]+?)\s*\]/i);
  return m ? m[1].trim().toLowerCase().replace(/\s+/g, '') : null;
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
      messages: { where: { direction: 'INBOUND' }, orderBy: { createdAt: 'asc' }, take: 1, select: { content: true } },
    },
  });

  const acc = {};
  for (const c of chats) {
    const k = clave(c.messages[0]?.content);
    if (!k) continue;
    (acc[k] ||= { chats: 0, clientes: new Set() });
    acc[k].chats++;
    if (c.clientId) acc[k].clientes.add(c.clientId);
  }

  const ids = [...new Set(Object.values(acc).flatMap(g => [...g.clientes]))];
  const ventas = ids.length
    ? await prisma.order.findMany({
        where: { clientId: { in: ids }, createdAt: { gte: desde } },
        select: { clientId: true, total: true },
      })
    : [];

  const porCliente = {};
  for (const v of ventas) {
    (porCliente[v.clientId] ||= { n: 0, monto: 0 });
    porCliente[v.clientId].n++;
    porCliente[v.clientId].monto += Number(v.total || 0);
  }

  for (const g of Object.values(acc)) {
    g.compraron = 0; g.ventas = 0; g.facturado = 0;
    for (const cid of g.clientes) {
      const v = porCliente[cid];
      if (v) { g.compraron++; g.ventas += v.n; g.facturado += v.monto; }
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
    const v = ventas[k] || { chats: 0, compraron: 0, ventas: 0, facturado: 0 };
    return {
      k, gasto: g.gasto, convMeta: g.convMeta,
      chats: v.chats, compraron: v.compraron, ventas: v.ventas, facturado: v.facturado,
      roas: g.gasto > 0 ? v.facturado / g.gasto : null,
      cac: v.compraron > 0 ? g.gasto / v.compraron : null,
    };
  }).sort((a, b) => b.facturado - a.facturado);

  const $ = n => '$' + Math.round(n).toLocaleString('es-AR');
  const pad = (s, n) => String(s).padEnd(n);
  const num = (s, n) => String(s).padStart(n);

  console.log(`\n═══ RETORNO REAL POR ANUNCIO · últimos ${dias} días (dólar $${rate}) ═══\n`);
  console.log(pad('ANUNCIO', 18) + num('gasto', 11) + num('chats', 7) + num('clientes', 9) + num('facturado', 14) + num('ROAS', 8) + num('costo x cliente', 16));
  console.log('─'.repeat(83));

  const T = { gasto: 0, chats: 0, compraron: 0, ventas: 0, facturado: 0 };
  for (const f of filas) {
    if (!f.gasto && !f.facturado) continue;
    console.log(
      pad(f.k, 18) + num($(f.gasto), 11) + num(f.chats, 7) + num(f.compraron, 9) +
      num($(f.facturado), 14) + num(f.roas != null ? f.roas.toFixed(1) + 'x' : '—', 8) +
      num(f.cac != null ? $(f.cac) : '—', 16)
    );
    T.gasto += f.gasto; T.chats += f.chats; T.compraron += f.compraron;
    T.ventas += f.ventas; T.facturado += f.facturado;
  }

  console.log('─'.repeat(83));
  console.log(
    pad('TOTAL', 18) + num($(T.gasto), 11) + num(T.chats, 7) + num(T.compraron, 9) +
    num($(T.facturado), 14) + num(T.gasto > 0 ? (T.facturado / T.gasto).toFixed(1) + 'x' : '—', 8) +
    num(T.compraron > 0 ? $(T.gasto / T.compraron) : '—', 16)
  );

  if (T.chats) {
    console.log(`\n  ${T.ventas} ventas · cierre ${(T.compraron / T.chats * 100).toFixed(1)}% de las conversaciones` +
      (T.compraron ? ` · ticket promedio ${$(T.facturado / T.compraron)}` : ''));
    console.log(`  Por cada peso invertido volvieron ${$(T.facturado / T.gasto)} en facturación.`);
  }
  console.log('\n  Atribución: primer mensaje del chat con la etiqueta del anuncio, y ventas');
  console.log('  de ese cliente dentro de la ventana. Es facturación, no ganancia.\n');

  await prisma.$disconnect();
})();
