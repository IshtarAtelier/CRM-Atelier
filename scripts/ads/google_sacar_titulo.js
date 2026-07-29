#!/usr/bin/env node
/**
 * Saca un título de la PMax al local y pone otro en su lugar.
 *
 * "Armazón Vondel park Rudo" era un modelo suelto ocupando uno de los 15
 * lugares: no le dice nada a nadie que no conozca ese armazón. Sale, y entra
 * un diferencial.
 *
 * Cada candidato se prueba con validateOnly ANTES de escribir: Google rechaza
 * por política más de lo que uno espera (ver google_titulos.js — los títulos
 * con "OFF" + porcentaje dan POLICY_FINDING PROHIBITED).
 *
 * Uso:
 *   node scripts/ads/google_sacar_titulo.js                            → dry run
 *   GOOGLE_ADS_ALLOW_WRITES=1 node scripts/ads/google_sacar_titulo.js --yes
 */

const { search, mutate, customerId } = require('./lib/google_client');

const CAMPANIA = 'Máximo rendimiento al local';
const SACAR_QUE_CONTENGA = /Vondel/i;
const CANDIDATOS = [
  'Anteojos recetados en Córdoba',
  'Mejor calificada en Córdoba',
  'Atención sin apuro',
];

async function main() {
  const aplicar = process.argv.includes('--yes');
  const cid = customerId();
  const grupo = `customers/${cid}/assetGroups/6684182860`;

  const rows = await search(`
    SELECT asset_group_asset.resource_name, asset.text_asset.text
    FROM asset_group_asset
    WHERE asset_group_asset.status != 'REMOVED' AND campaign.name = '${CAMPANIA}'
      AND asset_group_asset.field_type = 'HEADLINE'`);

  const objetivo = rows.find((r) => SACAR_QUE_CONTENGA.test(r.asset.textAsset.text));
  if (!objetivo) return console.log('Ya no está en la campaña. Nada para hacer.');

  console.log(`Títulos hoy: ${rows.length}`);
  console.log(`A sacar: "${objetivo.asset.textAsset.text}"`);
  console.log(`Candidatos a reemplazo (se prueba de a uno): ${CANDIDATOS.join(' · ')}`);

  if (!aplicar) {
    return console.log('\n(dry run — para aplicar: GOOGLE_ADS_ALLOW_WRITES=1 node scripts/ads/google_sacar_titulo.js --yes)');
  }

  await mutate('assetGroupAssets:mutate', { operations: [{ remove: objetivo.assetGroupAsset.resourceName }] }, { confirm: true });
  console.log(`\n✅ sacado: "${objetivo.asset.textAsset.text}"`);

  const yaEstan = new Set(rows.map((r) => r.asset.textAsset.text.toLowerCase()));
  for (const texto of CANDIDATOS) {
    if (yaEstan.has(texto.toLowerCase())) continue;
    try {
      const creado = await mutate('assets:mutate', { operations: [{ create: { textAsset: { text: texto }, type: 'TEXT' } }] }, { confirm: true });
      const asset = creado.results[0].resourceName;
      const op = { operations: [{ create: { assetGroup: grupo, asset, fieldType: 'HEADLINE' } }] };
      await mutate('assetGroupAssets:mutate', { ...op, validateOnly: true }, { confirm: true });
      await mutate('assetGroupAssets:mutate', op, { confirm: true });
      console.log(`✅ agregado en su lugar: "${texto}" (${texto.length} car.)`);
      return;
    } catch (e) {
      const motivo = /POLICY/.test(e.message) ? 'rechazado por política' : e.message.slice(0, 70);
      console.log(`⏭️  "${texto}" — ${motivo}`);
    }
  }
  console.log('Ningún candidato pasó. El lugar queda libre (14 títulos).');
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
