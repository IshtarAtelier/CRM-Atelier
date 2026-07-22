#!/usr/bin/env node
/**
 * Cruce ventas del CRM ↔ campañas de Meta Ads (solo lectura en ambos lados).
 *
 * Agrupa las compras propias (AnalyticsEvent type=purchase) por utm_campaign
 * y las compara con el gasto reportado por Meta para esas mismas campañas —
 * así se ve gasto real vs. ventas reales, no solo lo que Meta cree que generó
 * (las conversiones de Meta pueden estar sub o sobre-atribuidas).
 *
 * Uso:
 *   node scripts/ads/attribution_report.js                 → últimos 7 días, DB local
 *   node scripts/ads/attribution_report.js --days 30
 *   node scripts/ads/attribution_report.js --prod --yes    → contra prod (requiere ambos flags)
 *
 * Requiere las mismas env vars que meta_report.js para el lado de Meta.
 * Del lado del CRM usa DATABASE_URL (local) salvo --prod --yes → PROD_DATABASE_URL.
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { getAllPages, accountId, MetaApiError } = require('./lib/meta_client');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

function usage(msg) {
  console.error(msg);
  console.error('Uso: node scripts/ads/attribution_report.js [--days N] [--prod --yes]');
  process.exit(1);
}

function arDate(msAgo = 0) {
  return new Date(Date.now() - msAgo).toLocaleDateString('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

/** Medianoche de hace `daysAgo` días en Argentina (sin DST, -03:00 fijo es seguro). */
function arDayStart(daysAgo) {
  return new Date(`${arDate(daysAgo * 864e5)}T00:00:00-03:00`);
}

const fmt = (n) => Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });

function resolvePrisma() {
  const wantsProd = process.argv.includes('--prod');
  const confirmed = process.argv.includes('--yes');
  if (wantsProd && !confirmed) {
    usage('Falta --yes: correr contra producción exige --prod Y --yes juntos (nunca uno solo).');
  }
  if (wantsProd) {
    const url = process.env.PROD_DATABASE_URL;
    if (!url) usage('Falta PROD_DATABASE_URL en el entorno.');
    console.log('⚠ Corriendo SOLO LECTURA contra la base de PRODUCCIÓN.');
    return new PrismaClient({ datasources: { db: { url } } });
  }
  return new PrismaClient(); // DATABASE_URL local, por defecto
}

async function main() {
  const daysArg = arg('days', '7');
  const days = Number(daysArg);
  if (!Number.isFinite(days) || days <= 0) usage(`--days debe ser un número positivo (recibido: "${daysArg}").`);

  const prisma = resolvePrisma();
  // Ventana = últimos N días CALENDARIO completos en Argentina, sin contar hoy —
  // idéntica en ambos lados para que el ROAS compare peras con peras.
  const since = arDayStart(days);
  const until = arDayStart(0);

  try {
    // Lado CRM: TODAS las compras propias del período. Las nuevas ya traen las
    // UTM estampadas (recordServerEvent las hereda de la sesión); para las
    // viejas —grabadas solo con sessionId— se resuelve la atribución acá,
    // buscando el último evento con UTM de esa misma sesión.
    const purchases = await prisma.analyticsEvent.findMany({
      where: { type: 'purchase', createdAt: { gte: since, lt: until } },
      select: { utmCampaign: true, utmSource: true, sessionId: true, value: true, orderId: true, createdAt: true },
    });

    const orphanSessions = [...new Set(purchases.filter((p) => !p.utmCampaign).map((p) => p.sessionId))];
    const sessionAttr = new Map(); // sessionId -> { utmCampaign, utmSource }
    if (orphanSessions.length) {
      // Regla canónica (misma que recordServerEvent y el cron ads-report):
      // último evento CON utm_campaign de la sesión. asc + set incondicional
      // deja el más nuevo (last-touch).
      const attrEvents = await prisma.analyticsEvent.findMany({
        where: { sessionId: { in: orphanSessions }, utmCampaign: { not: null } },
        orderBy: { createdAt: 'asc' },
        select: { sessionId: true, utmCampaign: true, utmSource: true },
      });
      for (const ev of attrEvents) sessionAttr.set(ev.sessionId, ev);
    }

    let unattributed = { count: 0, revenue: 0 };
    const bySale = new Map(); // utmCampaign -> { count, revenue, source }
    for (const p of purchases) {
      const attr = p.utmCampaign ? p : sessionAttr.get(p.sessionId);
      if (!attr?.utmCampaign) {
        unattributed.count += 1;
        unattributed.revenue += Number(p.value || 0);
        continue;
      }
      const key = attr.utmCampaign;
      const acc = bySale.get(key) || { count: 0, revenue: 0, source: attr.utmSource };
      acc.count += 1;
      acc.revenue += Number(p.value || 0);
      bySale.set(key, acc);
    }

    // Lado Meta: gasto e insights por campaña, mismos N días completos (hasta
    // ayer inclusive — time_range de Meta es inclusivo en ambos extremos).
    const acct = accountId();
    const params = {
      level: 'campaign',
      fields: 'campaign_name,spend,actions',
      limit: '100',
      time_range: JSON.stringify({ since: arDate(days * 864e5), until: arDate(864e5) }),
    };
    const rows = await getAllPages(`${acct}/insights`, params);
    // Agregar por NOMBRE (puede haber dos campañas homónimas en Meta; el join
    // con utm_campaign solo conoce el nombre, así que se suman).
    const byMeta = new Map(); // campaign_name -> { spend, buys }
    for (const r of rows) {
      const key = r.campaign_name || '?';
      const acc = byMeta.get(key) || { spend: 0, buys: 0 };
      acc.spend += Number(r.spend || 0);
      acc.buys += Number(r.actions?.find((a) => a.action_type === 'purchase')?.value || 0);
      byMeta.set(key, acc);
    }

    console.log(`\n=== Ventas propias vs. gasto en Meta · últimos ${days} días ===\n`);

    const allCampaigns = new Set([...bySale.keys(), ...byMeta.keys()]);
    if (!allCampaigns.size) {
      console.log('Sin datos de campañas en el período (ni ventas atribuidas ni gasto en Meta).');
      return;
    }

    for (const campaign of allCampaigns) {
      const sale = bySale.get(campaign);
      const meta = byMeta.get(campaign);
      console.log(`▸ ${campaign}`);
      if (meta) {
        console.log(`  Meta reporta: gasto $${fmt(meta.spend)}${meta.buys ? ` · ${meta.buys} compras (según Meta)` : ' · sin compras reportadas'}`);
      } else {
        console.log('  Sin gasto registrado en Meta para este nombre de campaña en el período.');
      }
      if (sale) {
        const roas = meta && meta.spend > 0 ? (sale.revenue / meta.spend).toFixed(2) : '—';
        console.log(`  CRM confirma: ${sale.count} venta(s) por $${fmt(sale.revenue)} (origen: ${sale.source || '—'}) · ROAS real ≈ ${roas}`);
      } else {
        console.log('  Sin ventas propias atribuidas a esta campaña en el período.');
      }
      console.log('');
    }

    if (unattributed.count) {
      console.log(
        `▸ (sin atribución de campaña)\n  ${unattributed.count} venta(s) web por $${fmt(unattributed.revenue)} sin UTM — tráfico directo/orgánico o link de anuncio sin utm_campaign.\n`,
      );
    }

    console.log(
      'Nota: el cruce depende de que utm_campaign en los links de Meta coincida con el nombre de campaña ' +
        'en Ads Manager, y de que la venta ocurra dentro de la ventana de atribución (cookie/localStorage). ' +
        'Ventas sin utm_campaign figuran arriba como "(sin atribución de campaña)".',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  const msg = e instanceof MetaApiError ? `${e.message}\n${e.guidance}` : e.message;
  console.error(msg);
  process.exit(1);
});
