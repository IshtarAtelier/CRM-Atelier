#!/usr/bin/env node
/**
 * Pone el precio de OFERTA en las tarjetas de los carruseles de catálogo de
 * "Ventas | Tienda online" (Ishtar 28/9/26: "los precios salen sin el
 * descuento aplicado"). La tarjeta mostraba {{product.price}} (lista) aunque el
 * catálogo tuviera sale_price; {{product.current_price}} usa la oferta si la hay.
 *
 * Escribe en Meta. Un anuncio por vez con 20 s de pausa: la cuenta se maneja
 * muy por debajo del límite de llamadas.
 *
 * Uso:
 *   node scripts/ads/carruseles_precio_de_oferta.js                  → dry run
 *   META_ALLOW_WRITES=1 node scripts/ads/carruseles_precio_de_oferta.js --yes
 */
require('dotenv').config({ quiet: true });
const { getAllPages, post } = require('./lib/meta_client');

const CONJUNTOS = ['120251767928180023', '120251767953630023']; // Mujeres, Hombres
const PRECIO = '{{product.current_price}}';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const aplicar = process.argv.includes('--yes');
  const ads = [];
  for (const set of CONJUNTOS) {
    const a = await getAllPages(`${set}/ads`, {
      fields: 'id,name,creative{name,object_story_spec,product_set_id,asset_feed_spec,url_tags,degrees_of_freedom_spec}',
      limit: '20',
    });
    ads.push(...a.filter((x) => /Carrusel\]/.test(x.name)));
    await esperar(5000);
  }
  console.log(`Carruseles de catálogo: ${ads.length}`);
  for (const ad of ads) {
    const c = ad.creative;
    const spec = c.object_story_spec;
    if (spec?.template_data?.description === PRECIO) { console.log(`= ya estaba: ${ad.name}`); continue; }
    if (!aplicar) { console.log(`→ cambiaría: ${ad.name}`); continue; }
    spec.template_data.description = PRECIO;
    const ok = { confirm: true };
    const nuevo = await post('act_2107444353167176/adcreatives', {
      name: c.name,
      object_story_spec: JSON.stringify(spec),
      product_set_id: c.product_set_id,
      ...(c.asset_feed_spec ? { asset_feed_spec: JSON.stringify(c.asset_feed_spec) } : {}),
      ...(c.url_tags ? { url_tags: c.url_tags } : {}),
      ...(c.degrees_of_freedom_spec ? { degrees_of_freedom_spec: JSON.stringify(c.degrees_of_freedom_spec) } : {}),
    }, ok);
    await post(ad.id, { creative: JSON.stringify({ creative_id: nuevo.id }) }, ok);
    console.log(`✓ ${ad.name}`);
    await esperar(20000);
  }
  if (!aplicar) console.log('\nDRY RUN: no se tocó nada. Repetir con --yes (y META_ALLOW_WRITES=1 inline).');
  else console.log('\n✅ Listo: las tarjetas muestran el precio de oferta.');
}

main().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });
