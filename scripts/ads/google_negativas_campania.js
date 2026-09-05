#!/usr/bin/env node
/**
 * Carga las negativas de la lista compartida "General" DIRECTO en una campaña
 * que no puede usar listas compartidas.
 *
 * Por qué (4/9/2026): "Google Maps" es una campaña INTELIGENTE (SMART) y la
 * API rechaza vincularle una lista compartida (MUTATE_NOT_ALLOWED). Es la
 * campaña con más presupuesto activo y la que genera las llamadas, así que
 * quedaba fuera de toda la limpieza de negativas. La única vía es cargarle las
 * palabras como negativas propias de campaña.
 *
 * Uso:
 *   node scripts/ads/google_negativas_campania.js <idCampaña>           → dry run
 *   GOOGLE_ADS_ALLOW_WRITES=1 node scripts/ads/google_negativas_campania.js <idCampaña> --yes
 */
const { search, mutate, customerId } = require('./lib/google_client');

const SHARED_SET_ID = process.env.GOOGLE_ADS_NEGATIVE_SET_ID || '11042611019';
const norm = (s) => String(s || '').trim().toLowerCase();
const LOTE = 500; // la API tiene tope de operaciones por request

async function main() {
  const campaignId = process.argv.find((a) => /^\d{6,}$/.test(a));
  const aplicar = process.argv.includes('--yes');
  if (!campaignId) {
    console.error('Falta el id de la campaña. Ej: node scripts/ads/google_negativas_campania.js 21470538185');
    process.exit(1);
  }
  const cid = customerId();

  const [camp] = await search(
    `SELECT campaign.name, campaign.status, campaign.advertising_channel_type FROM campaign WHERE campaign.id = ${campaignId}`,
  );
  if (!camp) { console.error('Campaña no encontrada.'); process.exit(1); }

  const lista = await search(
    `SELECT shared_criterion.keyword.text, shared_criterion.keyword.match_type
     FROM shared_criterion WHERE shared_set.id = ${SHARED_SET_ID} LIMIT 5000`,
  );
  const propias = await search(
    `SELECT campaign_criterion.keyword.text, campaign_criterion.keyword.match_type
     FROM campaign_criterion
     WHERE campaign.id = ${campaignId} AND campaign_criterion.negative = true AND campaign_criterion.type = 'KEYWORD'`,
  );
  const yaEstan = new Set(
    propias.map((r) => `${norm(r.campaignCriterion?.keyword?.text)}|${r.campaignCriterion?.keyword?.matchType}`),
  );
  const faltan = lista
    .map((r) => [r.sharedCriterion.keyword.text, r.sharedCriterion.keyword.matchType])
    .filter(([t, m]) => !yaEstan.has(`${norm(t)}|${m}`));

  console.log(`Campaña: ${camp.campaign.name} (${camp.campaign.advertisingChannelType}, ${camp.campaign.status})`);
  console.log(`Lista "General": ${lista.length} términos · la campaña ya tiene ${propias.length} negativas propias`);
  console.log(`A agregar: ${faltan.length}\n`);
  faltan.slice(0, 30).forEach(([t, m]) => console.log(`  [${m.padEnd(6)}] ${t}`));
  if (faltan.length > 30) console.log(`  … y ${faltan.length - 30} más`);

  if (!faltan.length) { console.log('\nNada para hacer.'); return; }
  if (!aplicar) {
    console.log(`\n(dry run — no se tocó nada. Para aplicar: GOOGLE_ADS_ALLOW_WRITES=1 node scripts/ads/google_negativas_campania.js ${campaignId} --yes)`);
    return;
  }

  let hechos = 0;
  for (let i = 0; i < faltan.length; i += LOTE) {
    const operations = faltan.slice(i, i + LOTE).map(([text, matchType]) => ({
      create: {
        campaign: `customers/${cid}/campaigns/${campaignId}`,
        negative: true,
        keyword: { text, matchType },
      },
    }));
    const res = await mutate('campaignCriteria:mutate', { operations }, { confirm: true });
    hechos += res?.results?.length ?? 0;
    console.log(`  lote ${i / LOTE + 1}: ${res?.results?.length ?? 0} cargadas`);
  }
  console.log(`\n✅ Agregadas ${hechos} negativas a "${camp.campaign.name}".`);
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
