#!/usr/bin/env node
/**
 * Aplica la lista compartida de negativas "General" a las campañas que no la
 * tengan.
 *
 * Por qué existe (4/9/2026): la lista tenía 705 términos y estaba aplicada a
 * las campañas de búsqueda y a las de Máximo Rendimiento, pero NO a "Google
 * Maps" — que es una campaña inteligente, la de MAYOR presupuesto activo
 * ($4.577/día) y la que genera las llamadas. Toda la limpieza de negativas no
 * la tocaba. Ese es el agujero por el que entraban las llamadas de gente que
 * buscaba una clínica de oftalmología o una óptica de auto.
 *
 * Vincular una lista NO reinicia el aprendizaje: solo acota dónde se muestra.
 *
 * Uso:
 *   node scripts/ads/google_aplicar_lista_negativas.js            → dry run
 *   GOOGLE_ADS_ALLOW_WRITES=1 node scripts/ads/google_aplicar_lista_negativas.js --yes
 */
const { search, mutate, customerId } = require('./lib/google_client');

const SHARED_SET_ID = process.env.GOOGLE_ADS_NEGATIVE_SET_ID || '11042611019';

async function main() {
  const aplicar = process.argv.includes('--yes');
  const cid = customerId();

  const camps = await search(
    `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type
     FROM campaign WHERE campaign.status != 'REMOVED'`,
  );
  const links = await search(`SELECT campaign.id, shared_set.id FROM campaign_shared_set`);
  const yaTiene = new Set(
    links.filter((r) => String(r.sharedSet.id) === String(SHARED_SET_ID)).map((r) => String(r.campaign.id)),
  );

  const faltan = camps.filter((r) => !yaTiene.has(String(r.campaign.id)));
  console.log(`Lista "General" (${SHARED_SET_ID}) aplicada hoy a ${yaTiene.size} campañas.\n`);
  if (!faltan.length) {
    console.log('Todas las campañas ya la tienen. Nada para hacer.');
    return;
  }
  console.log('Campañas SIN la lista:');
  faltan.forEach((r) =>
    console.log(`  ${r.campaign.status.padEnd(8)} ${String(r.campaign.advertisingChannelType).padEnd(16)} ${r.campaign.name}`),
  );

  if (!aplicar) {
    console.log('\n(dry run — no se tocó nada. Para aplicar: GOOGLE_ADS_ALLOW_WRITES=1 node scripts/ads/google_aplicar_lista_negativas.js --yes)');
    return;
  }

  // De a una: las campañas inteligentes (SMART) pueden rechazar la vinculación,
  // y un lote entero fallaría por culpa de una. Se informa cuál no aceptó.
  let ok = 0;
  for (const r of faltan) {
    const operations = [{
      create: {
        campaign: `customers/${cid}/campaigns/${r.campaign.id}`,
        sharedSet: `customers/${cid}/sharedSets/${SHARED_SET_ID}`,
      },
    }];
    try {
      await mutate('campaignSharedSets:mutate', { operations }, { confirm: true });
      console.log(`  ✅ ${r.campaign.name}`);
      ok++;
    } catch (e) {
      console.log(`  ❌ ${r.campaign.name} — ${e.message.slice(0, 160)}`);
    }
  }
  console.log(`\nVinculadas ${ok} de ${faltan.length}.`);
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
