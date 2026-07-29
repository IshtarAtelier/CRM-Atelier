#!/usr/bin/env node
/**
 * Términos de búsqueda reales que dispararon los anuncios (solo lectura, GAQL).
 *
 * Nace de un caso concreto (29/7/2026): un contacto llegó por Google Ads
 * preguntando por "ópticas para vehículos" — faros de auto. La óptica paga ese
 * clic y esa conversación. Este reporte muestra por qué término entra la gente
 * y marca los que no tienen nada que ver, para cargarlos como negativos.
 *
 * Uso:
 *   node scripts/ads/google_terminos.js               → últimos 30 días
 *   node scripts/ads/google_terminos.js --days 90
 *   node scripts/ads/google_terminos.js --json
 */

const { search } = require('./lib/google_client');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

function arDate(msAgo = 0) {
  return new Date(Date.now() - msAgo).toLocaleDateString('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
  });
}

const fmt = (n) => Number(n || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });

// Búsquedas que NO son de óptica humana. "óptica" también significa el faro del
// auto y el instrumento de laboratorio: son los dos sentidos que traen gente
// equivocada. La lista se usa solo para marcar el reporte, no escribe nada.
const FUERA_DE_RUBRO = [
  { etiqueta: 'auto/vehículo', re: /\b(auto|autos|vehic|vehíc|camion|camión|moto|furgon|furgón|fiat|ford|chevrolet|renault|peugeot|toyota|vw|volkswagen|gol|corsa|onix|amarok|hilux|ranger)\b/i },
  { etiqueta: 'faro/luz', re: /\b(faro|faros|farol|luz|luces|led|xenon|xenón|halogen|halógen|delantera|trasera|stop|giro|baliza)\b/i },
  { etiqueta: 'fibra óptica', re: /\b(fibra|internet|cable|router|modem|módem)\b/i },
  { etiqueta: 'instrumento', re: /\b(microscopio|telescopio|mira|binocular|lupa industrial)\b/i },
  { etiqueta: 'empleo', re: /\b(empleo|trabajo|curriculum|currículum|cv|vacante|busco trabajo)\b/i },
];

function clasificar(termino) {
  for (const f of FUERA_DE_RUBRO) if (f.re.test(termino)) return f.etiqueta;
  return null;
}

async function main() {
  const days = Number(arg('days', '30'));
  const asJson = process.argv.includes('--json');
  const desde = arDate(days * 864e5);
  const hasta = arDate(864e5);

  const rows = await search(`
    SELECT
      search_term_view.search_term,
      campaign.name,
      metrics.impressions,
      metrics.clicks,
      metrics.cost_micros,
      metrics.conversions
    FROM search_term_view
    WHERE segments.date BETWEEN '${desde}' AND '${hasta}'
      AND metrics.impressions > 0
    ORDER BY metrics.cost_micros DESC
    LIMIT 500
  `);

  const terminos = rows.map((r) => {
    const t = r.searchTermView?.searchTerm ?? r.search_term_view?.search_term ?? '';
    const m = r.metrics ?? {};
    const costo = Number(m.costMicros ?? m.cost_micros ?? 0) / 1e6;
    return {
      termino: t,
      campania: r.campaign?.name ?? '',
      impresiones: Number(m.impressions ?? 0),
      clics: Number(m.clicks ?? 0),
      costo,
      conversiones: Number(m.conversions ?? 0),
      fueraDeRubro: clasificar(t),
    };
  });

  if (asJson) {
    console.log(JSON.stringify(terminos, null, 2));
    return;
  }

  const malos = terminos.filter((t) => t.fueraDeRubro);
  const gastoMalo = malos.reduce((a, t) => a + t.costo, 0);
  const gastoTotal = terminos.reduce((a, t) => a + t.costo, 0);
  const clicsMalos = malos.reduce((a, t) => a + t.clics, 0);

  console.log(`Términos de búsqueda · ${desde} → ${hasta} (${days} días)\n`);
  console.log(`  Términos distintos : ${terminos.length}`);
  console.log(`  Gasto total        : $${fmt(gastoTotal)}`);
  console.log(`  FUERA DE RUBRO     : ${malos.length} términos · ${clicsMalos} clics · $${fmt(gastoMalo)}` +
    (gastoTotal ? `  (${((gastoMalo / gastoTotal) * 100).toFixed(1)}% del gasto)` : ''));

  if (malos.length) {
    console.log('\n── LO QUE NO ES DE ÓPTICA (candidatos a palabra negativa) ──');
    malos.sort((a, b) => b.costo - a.costo).slice(0, 40).forEach((t) => {
      console.log(`  $${fmt(t.costo).padStart(9)}  ${String(t.clics).padStart(4)} clics  [${t.fueraDeRubro}]  "${t.termino}"`);
    });
  }

  console.log('\n── LOS 20 QUE MÁS GASTAN (todos) ──');
  terminos.slice(0, 20).forEach((t) => {
    console.log(`  $${fmt(t.costo).padStart(9)}  ${String(t.clics).padStart(4)} clics  ${t.fueraDeRubro ? '❌' : '  '} "${t.termino}"`);
  });
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
