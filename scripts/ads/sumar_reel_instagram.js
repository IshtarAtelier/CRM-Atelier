#!/usr/bin/env node
/**
 * Suma un reel YA PUBLICADO en Instagram como anuncio en los dos conjuntos de
 * "Ventas | Tienda online" (Mujeres y Hombres). Se usa el post tal cual
 * (source_instagram_media_id): sale con sus me gusta y comentarios.
 * Pedido de Ishtar 28/9/26: el reel del filtro amarillo.
 *
 * Escribe en Meta: 2 creativos + 2 anuncios, con pausa entre cada uno.
 *
 *   node scripts/ads/sumar_reel_instagram.js <media_id> <nombre>                  → dry run
 *   META_ALLOW_WRITES=1 node scripts/ads/sumar_reel_instagram.js <media_id> <nombre> --yes
 */
require('dotenv').config({ quiet: true });
const { get, getAllPages, post } = require('./lib/meta_client');

const ACT = 'act_2107444353167176';
const ORIGEN = 'https://atelieroptica.com.ar';
const CONJUNTOS = [
  { id: '120251767928180023', etiqueta: 'Mujeres', genero: 'femme' },
  { id: '120251767953630023', etiqueta: 'Hombres', genero: 'homme' },
];
const URL_TAGS = 'utm_source=meta&utm_medium=paid&utm_campaign={{campaign.id}}&utm_content={{ad.id}}';
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const [mediaId, nombre] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  if (!mediaId || !nombre) throw new Error('Uso: sumar_reel_instagram.js <media_id> <nombre> [--yes]');
  const aplicar = process.argv.includes('--yes');

  // Página e Instagram: los mismos que usan los anuncios que ya andan.
  const ref = await getAllPages(`${CONJUNTOS[0].id}/ads`, { fields: 'name,creative{object_story_spec}', limit: '20' });
  const spec = ref.map((a) => a.creative?.object_story_spec).find((s) => s?.page_id && s?.instagram_user_id);
  if (!spec) throw new Error('No encontré página + Instagram en los anuncios del conjunto.');

  for (const c of CONJUNTOS) {
    const ya = ref.length && c === CONJUNTOS[0]
      ? ref.some((a) => a.name.includes(`[${nombre}]`))
      : (await getAllPages(`${c.id}/ads`, { fields: 'name', limit: '30' })).some((a) => a.name.includes(`[${nombre}]`));
    const link = `${ORIGEN}/tienda?genero=${c.genero}&categoria=Receta`;
    const nombreAnuncio = `[${nombre}] Reel de Instagram · ${c.etiqueta}`;
    if (ya) { console.log(`= ya existe en ${c.etiqueta}`); continue; }
    if (!aplicar) { console.log(`→ sumaría "${nombreAnuncio}" → ${link}`); continue; }
    const ok = { confirm: true };
    const cr = await post(`${ACT}/adcreatives`, {
      name: nombreAnuncio,
      object_id: spec.page_id,
      instagram_user_id: spec.instagram_user_id,
      source_instagram_media_id: mediaId,
      call_to_action: JSON.stringify({ type: 'SHOP_NOW', value: { link } }),
      url_tags: URL_TAGS,
    }, ok);
    await esperar(5000);
    const ad = await post(`${ACT}/ads`, { name: nombreAnuncio, adset_id: c.id, creative: JSON.stringify({ creative_id: cr.id }), status: 'ACTIVE' }, ok);
    console.log(`✓ ${nombreAnuncio} ${ad.id}`);
    await esperar(15000);
  }
  if (!aplicar) console.log('\nDRY RUN: repetir con --yes (y META_ALLOW_WRITES=1 inline).');
  else {
    const chequeo = await get(CONJUNTOS[0].id, { fields: 'effective_status' });
    console.log(`\n✅ Listo. Conjunto Mujeres: ${chequeo.effective_status}.`);
  }
}

main().catch((e) => { console.error(`✗ ${e.message}`); process.exit(1); });
