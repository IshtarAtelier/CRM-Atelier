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
  const since = new Date(Date.now() - days * 864e5);

  try {
    // Lado CRM: compras propias con atribución de campaña, agrupadas.
    const purchases = await prisma.analyticsEvent.findMany({
      where: { type: 'purchase', createdAt: { gte: since }, utmCampaign: { not: null } },
      select: { utmCampaign: true, utmSource: true, value: true, orderId: true, createdAt: true },
    });

    const bySale = new Map(); // utmCampaign -> { count, revenue, source }
    for (const p of purchases) {
      const key = p.utmCampaign || '(sin campaña)';
      const acc = bySale.get(key) || { count: 0, revenue: 0, source: p.utmSource };
      acc.count += 1;
      acc.revenue += Number(p.value || 0);
      bySale.set(key, acc);
    }

    // Lado Meta: gasto e insights por campaña, mismo período.
    const acct = accountId();
    const params = {
      level: 'campaign',
      fields: 'campaign_name,spend,actions,cost_per_action_type',
      limit: '100',
      time_range: JSON.stringify({ since: arDate(days * 864e5), until: arDate(0) }),
    };
    const rows = await getAllPages(`${acct}/insights`, params);
    const byMeta = new Map(rows.map((r) => [r.campaign_name, r]));

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
        const metaBuys = meta.actions?.find((a) => a.action_type === 'purchase')?.value;
        console.log(`  Meta reporta: gasto $${fmt(meta.spend)}${metaBuys ? ` · ${metaBuys} compras (según Meta)` : ' · sin compras reportadas'}`);
      } else {
        console.log('  Sin gasto registrado en Meta para este nombre de campaña en el período.');
      }
      if (sale) {
        const roas = meta?.spend > 0 ? (sale.revenue / meta.spend).toFixed(2) : '—';
        console.log(`  CRM confirma: ${sale.count} venta(s) por $${fmt(sale.revenue)} (origen: ${sale.source || '—'}) · ROAS real ≈ ${roas}`);
      } else {
        console.log('  Sin ventas propias atribuidas a esta campaña en el período.');
      }
      console.log('');
    }

    console.log(
      'Nota: el cruce depende de que utm_campaign en los links de Meta coincida con el nombre de campaña ' +
        'en Ads Manager, y de que la venta ocurra dentro de la ventana de atribución (cookie/localStorage). ' +
        'Ventas sin utm_campaign no aparecen acá aunque hayan salido de un anuncio.',
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
