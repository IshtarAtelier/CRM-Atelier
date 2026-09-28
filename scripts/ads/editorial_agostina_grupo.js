#!/usr/bin/env node
/**
 * Arregla el anuncio [ventaMujeresEditorial] (fotos de Agostina): en un conjunto
 * que promociona el catálogo, Meta exige que el creativo tenga product_set_id
 * (error 1885027 "Falta el conjunto de productos", 28/9/26). Se le asigna
 * "Mujeres · todo". Escribe en Meta: 3 llamadas.
 *
 *   node scripts/ads/editorial_agostina_grupo.js                  → dry run
 *   META_ALLOW_WRITES=1 node scripts/ads/editorial_agostina_grupo.js --yes
 */
require('dotenv').config({ quiet: true });
const { get, post } = require('./lib/meta_client');

const ANUNCIO = '120251767934100023';
const GRUPO_MUJERES = '1118506153902265';

async function main() {
  const ad = await get(ANUNCIO, { fields: 'name,creative{name,object_story_spec,url_tags,degrees_of_freedom_spec}' });
  const c = ad.creative;
  console.log(`Anuncio: ${ad.name}`);
  if (!process.argv.includes('--yes')) { console.log('DRY RUN: repetir con --yes (y META_ALLOW_WRITES=1 inline).'); return; }
  const ok = { confirm: true };
  const nuevo = await post('act_2107444353167176/adcreatives', {
    name: c.name,
    object_story_spec: JSON.stringify(c.object_story_spec),
    product_set_id: GRUPO_MUJERES,
    ...(c.url_tags ? { url_tags: c.url_tags } : {}),
    ...(c.degrees_of_freedom_spec ? { degrees_of_freedom_spec: JSON.stringify(c.degrees_of_freedom_spec) } : {}),
  }, ok);
  await post(ANUNCIO, { creative: JSON.stringify({ creative_id: nuevo.id }) }, ok);
  console.log('✅ Listo: el anuncio de Agostina tiene su grupo de productos.');
}

main().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });
