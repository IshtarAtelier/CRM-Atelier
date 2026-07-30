#!/usr/bin/env node
/**
 * Baja el techo de presupuesto de una campaña de Google Ads.
 *
 * Por qué: la cuenta tiene $46.662/día autorizados ($1.399.860/mes) y gasta
 * $19.832/día ($594.963/mes). Sobran ~$800.000 mensuales habilitados que hoy
 * nadie usa — pero que el algoritmo puede empezar a usar sin que nadie lo firme.
 *
 * El caso más expuesto es "Campaña de Ventas de Maximo Rendimiento": $11.260/día
 * autorizados, gasta $401/día, CERO conversiones en 30 días. Hoy no puede
 * despegar porque le falta señal, pero cuando la medición del gclid empiece a
 * mandarle ventas reales la va a tener — y con "maximizar conversiones" y ese
 * techo puede arrancar a gastar en serio sin resultado probado.
 *
 * Bajar el techo NO cambia el gasto de una campaña que no lo alcanza: el nuevo
 * tope queda arriba de lo que gasta. No es un recorte, es un límite.
 *
 * Verificado antes de tocar: ningún presupuesto de la cuenta es compartido
 * (reference_count = 1 en todos), así que el cambio no arrastra a otra campaña.
 *
 * Uso:
 *   node scripts/ads/google_presupuesto.js                       → dry run
 *   GOOGLE_ADS_ALLOW_WRITES=1 node scripts/ads/google_presupuesto.js --yes
 */

const { search, mutate } = require('./lib/google_client');

// campaña → nuevo techo diario en pesos
const NUEVOS_TECHOS = {
  'Campaña de Ventas de Maximo Rendimiento': 600,
};

const f = (n) => Math.round(n).toLocaleString('es-AR');

async function main() {
  const aplicar = process.argv.includes('--yes');
  const nombres = Object.keys(NUEVOS_TECHOS);

  const rows = await search(`
    SELECT campaign.name, campaign.status, campaign_budget.resource_name,
           campaign_budget.amount_micros, campaign_budget.reference_count
    FROM campaign
    WHERE campaign.name IN (${nombres.map((n) => `'${n.replace(/'/g, "\\'")}'`).join(',')})`);

  if (!rows.length) throw new Error('No se encontró ninguna de las campañas indicadas');

  const ops = [];
  console.log('CAMBIOS DE TECHO DE PRESUPUESTO\n');

  for (const r of rows) {
    const nombre = r.campaign.name;
    const actual = Number(r.campaignBudget.amountMicros || 0) / 1e6;
    const nuevo = NUEVOS_TECHOS[nombre];
    const compartido = Number(r.campaignBudget.referenceCount || 1) > 1;

    if (compartido) {
      console.log(`  ⛔ "${nombre}": el presupuesto es COMPARTIDO. Se saltea — tocarlo afectaría a otras campañas.`);
      continue;
    }
    if (nuevo >= actual) {
      console.log(`  ⏭️  "${nombre}": el techo actual ($${f(actual)}) ya es menor o igual al propuesto. Sin cambios.`);
      continue;
    }

    console.log(`  "${nombre}" [${r.campaign.status}]`);
    console.log(`     techo: $${f(actual)}/día  →  $${f(nuevo)}/día`);
    console.log(`     al mes: $${f(actual * 30)}  →  $${f(nuevo * 30)}   (libera $${f((actual - nuevo) * 30)})`);

    ops.push({
      update: {
        resourceName: r.campaignBudget.resourceName,
        amountMicros: String(Math.round(nuevo * 1e6)),
      },
      updateMask: 'amount_micros',
    });
  }

  if (!ops.length) return console.log('\nNada para hacer.');

  if (!aplicar) {
    return console.log('\n(dry run — para aplicar: GOOGLE_ADS_ALLOW_WRITES=1 node scripts/ads/google_presupuesto.js --yes)');
  }

  const res = await mutate('campaignBudgets:mutate', { operations: ops }, { confirm: true });
  console.log(`\n✅ Actualizados ${res.results?.length ?? 0} presupuestos.`);
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
