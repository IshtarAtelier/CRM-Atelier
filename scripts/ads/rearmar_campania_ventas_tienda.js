#!/usr/bin/env node
/**
 * Rearma la campaña "Ventas | Tienda online" por GÉNERO y CATEGORÍA.
 *
 * Pedido de Ishtar (25/9/2026), antes de prenderla por primera vez:
 *  - carruseles todo receta, todo sol y todo clip-on, y reels igual, que
 *    compitan entre sí dentro de un mismo conjunto para ver cuál resuena;
 *  - separar mujeres y hombres;
 *  - que al entrar a la tienda caigan en el área filtrada de su género;
 *  - en los modelos de hombre, sin las fotos de Agostina (solo producto).
 *
 * Validado antes con execution_options=validate_only (no crea nada): un
 * conjunto de catálogo acepta anuncios de catálogo con grupos de productos
 * distintos Y anuncios de video.
 *
 * Flujo obligatorio (scripts/ads/CLAUDE.md): sin --yes es DRY RUN; con --yes
 * escribe, solo con META_ALLOW_WRITES=1 INLINE. Como la campaña nunca
 * entregó, cambiarla no reinicia ningún aprendizaje. La campaña queda PAUSADA.
 *
 * Uso:
 *   node --env-file=.env scripts/ads/rearmar_campania_ventas_tienda.js
 *   META_ALLOW_WRITES=1 node --env-file=.env scripts/ads/rearmar_campania_ventas_tienda.js --yes
 *
 * QUÉ HACE
 *  1. Crea en el catálogo los grupos de productos (si no existen): por género
 *     (mujer = female + unisex; hombre = male + unisex) y categoría
 *     (custom_label_0 del feed). A los de hombre les saca los modelos que son
 *     solo de mujer aunque la ficha diga unisex (Calipso y Onix).
 *  2. Sube los reels por género y categoría (desde atelieroptica.com.ar).
 *  3. Crea dos conjuntos, "Mujeres" y "Hombres": público de ese género SIN
 *     Advantage+ audience (con Advantage+ el género es solo una sugerencia y
 *     se mezclarían), todo el país, 25-65, sin compradores web de 180 días,
 *     optimizando por agregar al carrito.
 *  4. En cada uno, seis anuncios que compiten: carrusel receta, sol y clip-on
 *     (cada tarjeta lleva a su ficha) y reel receta, sol y clip-on. El resto de
 *     los enlaces llevan al área filtrada: /tienda?genero=…&categoria=…
 *  5. Pausa los dos conjuntos anteriores ("Catálogo | Todo el país" y
 *     "Reels | Todo el país"). No borra nada.
 *  El presupuesto no cambia: US$5/día de campaña, repartido por Meta.
 */

require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { get, getAllPages, post, MetaApiError } = require('./lib/meta_client');

const EJECUTAR = process.argv.includes('--yes');
const ACT = 'act_2107444353167176';
const CAMPANIA = '120251725614000023';
const CONJUNTOS_VIEJOS = ['120251725615390023', '120251725616210023'];
const CATALOGO = '1010336864958719';
const PIXEL = process.env.META_PIXEL_ID;
const ORIGEN = 'https://atelieroptica.com.ar';
const URL_TAGS = 'utm_source=meta&utm_medium=paid&utm_campaign={{campaign.id}}&utm_content={{ad.id}}';

// Modelos SOLO DE MUJER aunque en la ficha figuren como unisex (Ishtar,
// 25/9/26: "Calipso y Onix solo de mujer"). Se sacan de los grupos de hombre:
// además, dos de ellos tienen de foto principal una persona, y en los de hombre
// no va ninguna foto de Agostina. Ids del feed (<g:id>), verificados el 25/9/26.
const SOLO_MUJER = [
  'cmtlrdf1o01igfuv2cru0gaqc', // Calipso oval negro (foto principal: Agostina)
  'cmtlrc4si01iefuv2r0zzkzvl', // Calipso oval carey
  'cmtm9t0w60225fuv21yltbfyh', // Onix negro
  'cmtofsse51c6aeccc861e3150', // Onix carey (foto principal: una selfie, no de estudio)
];

const CATEGORIAS = [
  { clave: 'Receta', slug: 'receta', nombre: 'Armazones de receta', emoji: '👓' },
  { clave: 'Sol', slug: 'sol', nombre: 'Lentes de sol', emoji: '😎' },
  { clave: 'Clip-On', slug: 'clipon', nombre: 'Armazones con clip-on', emoji: '🕶️' },
];
const GENEROS = [
  { clave: 'mujer', tienda: 'femme', meta: [2], feed: ['female', 'unisex'], excluir: [], etiqueta: 'Mujeres' },
  { clave: 'hombre', tienda: 'homme', meta: [1], feed: ['male', 'unisex'], excluir: SOLO_MUJER, etiqueta: 'Hombres' },
];

/**
 * Carrusel editorial de Agostina (fotos de la sesión en el local, Ishtar
 * 25/9/26: "incluí estas imágenes en las campañas" y "cada foto debería llevar
 * a su anteojo correspondiente"). Solo en el conjunto de Mujeres: en los de
 * hombre no van fotos de Agostina. Los modelos los confirmó Ishtar el 25/9:
 * Dionisio, Vega y Onix. La 5, mirando la estantería, lleva a la tienda de
 * mujer entera.
 */
const EDITORIAL = [
  { foto: '01.jpg', nombre: 'Dionisio', detalle: 'Armazón de receta · carey', link: `${ORIGEN}/producto/dionisio-c2` },
  { foto: '02.jpg', nombre: 'Vega', detalle: 'Lentes de sol · dorado', link: `${ORIGEN}/producto/vega-c1` },
  { foto: '03.jpg', nombre: 'Onix', detalle: 'Armazón de receta · negro', link: `${ORIGEN}/producto/capsula-escarlata-onix-tendencia-rectangular-negro-armazon-receta` },
  { foto: '04.jpg', nombre: 'Onix', detalle: 'Armazón de receta · negro', link: `${ORIGEN}/producto/capsula-escarlata-onix-tendencia-rectangular-negro-armazon-receta` },
  { foto: '05.jpg', nombre: 'Elegí los tuyos', detalle: 'Receta, sol y clip-on', link: `${ORIGEN}/tienda?genero=femme` },
];

/** El reel de cada combinación. Clip-on es uno solo: los 10 modelos son unisex. */
const reelDe = (g, c) => (c.slug === 'clipon' ? 'desfile-tienda-clipon' : `desfile-${g.clave}-${c.slug}`);
const areaDe = (g, c) => `${ORIGEN}/tienda?genero=${g.tienda}&categoria=${encodeURIComponent(c.clave)}`;

const MEJORAS_DESACTIVADAS = {
  image_templates: { enroll_status: 'OPT_OUT' },
  image_touchups: { enroll_status: 'OPT_OUT' },
  image_brightness_and_contrast: { enroll_status: 'OPT_OUT' },
  text_optimizations: { enroll_status: 'OPT_OUT' },
  product_extensions: { enroll_status: 'OPT_OUT' },
  site_extensions: { enroll_status: 'OPT_OUT' },
};

function cuotasDeBusinessInfo() {
  const ts = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'lib', 'business-info.ts'), 'utf8');
  const m = ts.match(/\binstallmentsPromo:\s*"((?:[^"\\]|\\.)*)"/);
  if (!m) throw new Error('No se pudo leer installmentsPromo de business-info.ts.');
  return m[1].charAt(0).toUpperCase() + m[1].slice(1);
}

const J = (o) => JSON.stringify(o);
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

/** Filtro de un grupo de productos del catálogo. */
function filtroDe(g, c) {
  const partes = [{ or: g.feed.map((v) => ({ gender: { eq: v } })) }];
  if (c) partes.push({ custom_label_0: { eq: c.clave } });
  if (g.excluir.length) partes.push({ retailer_id: { is_not_any: g.excluir } });
  return { and: partes };
}
const nombreGrupo = (g, c) => `${g.etiqueta}${c ? ` · ${c.clave}` : ' · todo'}`;

async function main() {
  if (!PIXEL) throw new Error('Falta META_PIXEL_ID.');
  const cuotas = cuotasDeBusinessInfo();

  // ── Lecturas ──────────────────────────────────────────────────────────────
  const camp = await get(CAMPANIA, { fields: 'name,status,effective_status' });
  if (camp.effective_status !== 'PAUSED') throw new Error(`La campaña está ${camp.effective_status}: se rearma solo pausada.`);
  const setsActuales = await getAllPages(`${CAMPANIA}/adsets`, { fields: 'id,name,effective_status', limit: '20' });
  const yaRearmada = setsActuales.find((s) => /^(Mujeres|Hombres) \|/.test(s.name));
  if (yaRearmada) { console.log(`Ya está rearmada ("${yaRearmada.name}"). No se repite.`); return; }

  const refAds = await getAllPages('120251235949780023/ads', { fields: 'creative{object_story_spec}', limit: '5' });
  const spec = refAds.map((a) => a.creative?.object_story_spec).find((s) => s?.page_id);
  const refSets = await getAllPages('120251235949780023/adsets', { fields: 'targeting', limit: '5' });
  const excluirPublico = (refSets[0]?.targeting?.excluded_custom_audiences || []).filter((a) => /compradores web/i.test(a.name));
  const gruposExistentes = await getAllPages(`${CATALOGO}/product_sets`, { fields: 'id,name,product_count', limit: '100' });
  // El título de cada tarjeta del carrusel es custom_label_3 (el nombre del
  // modelo, "Onix Negro"; lo agrega src/lib/ads/product-feed.ts). Si Meta
  // todavía no releyó el feed, la tarjeta saldría sin nombre: no se crea nada.
  const productos = await getAllPages(`${CATALOGO}/products`, { fields: 'retailer_id,custom_label_3', limit: '100' });
  const sinNombreCorto = productos.filter((p) => !String(p.custom_label_3 || '').trim());

  for (const g of GENEROS) for (const c of CATEGORIAS) {
    const archivo = path.join(__dirname, '..', '..', 'public', 'social', 'reels', `${reelDe(g, c)}.mp4`);
    if (!fs.existsSync(archivo)) throw new Error(`Falta ${archivo}.`);
  }

  // ── Plan ──────────────────────────────────────────────────────────────────
  console.log(`\nCampaña "${camp.name}" (${CAMPANIA}) · ${camp.effective_status} · presupuesto sin cambios`);
  console.log('\n1. Grupos de productos en el catálogo:');
  for (const g of GENEROS) for (const c of [null, ...CATEGORIAS]) {
    const n = nombreGrupo(g, c);
    const ya = gruposExistentes.find((x) => x.name === n);
    console.log(`   ${ya ? '= ya existe' : '+ crear   '} "${n}"  filtro ${J(filtroDe(g, c))}`);
  }
  console.log('\n2. Reels a subir:', [...new Set(GENEROS.flatMap((g) => CATEGORIAS.map((c) => reelDe(g, c))))].join(', '));
  for (const g of GENEROS) {
    console.log(`\n3. Conjunto "${g.etiqueta} | Todo el país": solo ${g.clave === 'mujer' ? 'mujeres' : 'hombres'}, 25-65, Argentina, sin Advantage+ audience${excluirPublico.length ? `, excluye ${excluirPublico.map((a) => a.name).join(', ')}` : ''} · agregar al carrito`);
    for (const c of CATEGORIAS) {
      console.log(`   [venta${g.etiqueta}${c.slug}Carrusel] carrusel ${c.clave} (${nombreGrupo(g, c)}) · tarjetas → su ficha · resto → ${areaDe(g, c)}`);
      console.log(`   [venta${g.etiqueta}${c.slug}Reel] reel ${reelDe(g, c)}.mp4 → ${areaDe(g, c)}`);
    }
  }
  console.log(`\n   + en Mujeres: [ventaMujeresEditorial] carrusel con las ${EDITORIAL.length} fotos de Agostina:`);
  for (const e of EDITORIAL) console.log(`     ${e.foto} ${e.nombre} → ${e.link}`);
  for (const e of EDITORIAL) {
    if (!fs.existsSync(path.join(__dirname, '..', '..', 'public', 'social', 'ads-agostina', e.foto))) throw new Error(`Falta la foto ${e.foto}.`);
  }
  console.log(`\n4. Se pausan: ${setsActuales.filter((s) => CONJUNTOS_VIEJOS.includes(s.id)).map((s) => `"${s.name}"`).join(' y ')}`);
  console.log(`\nTexto (cuotas de business-info): "… ${cuotas}. Envío gratis a todo el país 🇦🇷"`);
  console.log(`Nombre corto en las tarjetas (custom_label_3): ${productos.length - sinNombreCorto.length} de ${productos.length} productos del catálogo lo tienen.`);

  if (!EJECUTAR) {
    console.log('\nDRY RUN: no se tocó nada. Repetir con --yes (y META_ALLOW_WRITES=1 inline) para aplicar.');
    return;
  }

  // ── Escrituras ────────────────────────────────────────────────────────────
  if (sinNombreCorto.length) {
    throw new Error(`${sinNombreCorto.length} productos del catálogo todavía no tienen el nombre corto (custom_label_3). ` +
      'Falta el deploy del feed o que Meta lo relea (Commerce Manager → Catálogo → Fuentes de datos → Actualizar). No se tocó nada.');
  }
  const ok = { confirm: true };

  // 1. Grupos de productos
  const grupo = {};
  for (const g of GENEROS) for (const c of [null, ...CATEGORIAS]) {
    const n = nombreGrupo(g, c);
    let ps = gruposExistentes.find((x) => x.name === n);
    if (!ps) ps = await post(`${CATALOGO}/product_sets`, { name: n, filter: J(filtroDe(g, c)) }, ok);
    const leido = await get(ps.id, { fields: 'id,name,product_count' });
    if (!leido.product_count) throw new Error(`El grupo "${n}" quedó con 0 productos: revisar el filtro antes de seguir.`);
    grupo[n] = leido.id;
    console.log(`✓ grupo "${n}" ${leido.id} (${leido.product_count} productos)`);
  }

  // 2. Videos
  const video = {};
  for (const archivo of [...new Set(GENEROS.flatMap((g) => CATEGORIAS.map((c) => reelDe(g, c))))]) {
    const v = await post(`${ACT}/advideos`, { file_url: `${ORIGEN}/social/reels/${archivo}.mp4`, name: archivo }, ok);
    video[archivo] = v.id;
    console.log(`✓ video ${archivo} (${v.id})`);
  }
  for (const [archivo, id] of Object.entries(video)) {
    for (let i = 0; i < 40; i++) {
      const s = await get(id, { fields: 'status' });
      if (s.status?.video_status === 'ready') break;
      if (s.status?.video_status === 'error') throw new Error(`Meta no pudo procesar ${archivo}.`);
      await esperar(6000);
    }
  }

  // 3 y 4. Conjuntos y anuncios
  for (const g of GENEROS) {
    const set = await post(`${ACT}/adsets`, {
      name: `${g.etiqueta} | Todo el país`,
      campaign_id: CAMPANIA,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'OFFSITE_CONVERSIONS',
      promoted_object: J({ pixel_id: PIXEL, custom_event_type: 'ADD_TO_CART', product_set_id: grupo[nombreGrupo(g, null)] }),
      targeting: J({
        geo_locations: { countries: ['AR'], location_types: ['home', 'recent'] },
        age_min: 25, age_max: 65, genders: g.meta,
        ...(excluirPublico.length ? { excluded_custom_audiences: excluirPublico.map((a) => ({ id: a.id })) } : {}),
        targeting_automation: { advantage_audience: 0 },
      }),
      attribution_spec: J([{ event_type: 'CLICK_THROUGH', window_days: 7 }, { event_type: 'VIEW_THROUGH', window_days: 1 }]),
      status: 'ACTIVE',
    }, ok);
    console.log(`\n✓ conjunto "${g.etiqueta} | Todo el país" ${set.id}`);

    const anuncio = async (nombre, creativo) => {
      const cr = await post(`${ACT}/adcreatives`, { name: nombre, url_tags: URL_TAGS,
        degrees_of_freedom_spec: J({ creative_features_spec: MEJORAS_DESACTIVADAS }), ...creativo }, ok);
      const a = await post(`${ACT}/ads`, { name: nombre, adset_id: set.id, creative: J({ creative_id: cr.id }), status: 'ACTIVE' }, ok);
      console.log(`  ✓ ${nombre} ${a.id}`);
    };
    const identidad = { page_id: spec.page_id, ...(spec.instagram_user_id ? { instagram_user_id: spec.instagram_user_id } : {}) };
    if (g.clave === 'mujer') {
      // Las fotos se suben por bytes (adimages): no hace falta que estén en la web.
      const tarjetas = [];
      for (const e of EDITORIAL) {
        const nombre = `agostina-${e.foto}`;
        const res = await post(`${ACT}/adimages`, { bytes: fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'social', 'ads-agostina', e.foto)).toString('base64'), name: nombre }, ok);
        const subida = res.images?.[nombre] || Object.values(res.images || {})[0];
        if (!subida?.hash) throw new Error(`Meta no devolvió hash para ${nombre}.`);
        tarjetas.push({ link: e.link, image_hash: subida.hash, name: e.nombre, description: e.detalle, call_to_action: { type: 'SHOP_NOW', value: { link: e.link } } });
      }
      await anuncio('[ventaMujeresEditorial] Agostina en Atelier', {
        object_story_spec: J({ ...identidad, link_data: {
          link: `${ORIGEN}/tienda?genero=femme`,
          message: `Elegí los tuyos en la tienda online 👓\n\n${cuotas}.\nEnvío gratis a todo el país 🇦🇷`,
          child_attachments: tarjetas,
          multi_share_optimized: false, // el orden de las fotos lo eligió Ishtar
          multi_share_end_card: false,
          call_to_action: { type: 'SHOP_NOW' },
        } }),
      });
    }
    for (const c of CATEGORIAS) {
      const texto = `${c.nombre}, en la tienda online ${c.emoji}\n\n${cuotas}.\nEnvío gratis a todo el país 🇦🇷`;
      await anuncio(`[venta${g.etiqueta}${c.slug}Carrusel] ${c.nombre} · ${g.etiqueta}`, {
        product_set_id: grupo[nombreGrupo(g, c)],
        object_story_spec: J({ ...identidad, template_data: {
          link: areaDe(g, c), message: texto, name: '{{product.custom_label_3}}',
          call_to_action: { type: 'SHOP_NOW' }, multi_share_end_card: false, format_option: 'carousel_images_multi_items',
        } }),
        asset_feed_spec: J({ ad_formats: ['CAROUSEL', 'COLLECTION'], optimization_type: 'FORMAT_AUTOMATION' }),
      });
      await anuncio(`[venta${g.etiqueta}${c.slug}Reel] ${c.nombre} · ${g.etiqueta}`, {
        object_story_spec: J({ ...identidad, video_data: {
          video_id: video[reelDe(g, c)],
          image_url: `${ORIGEN}/social/reels/${reelDe(g, c)}-cover.jpg`,
          title: `${c.nombre} con envío gratis`,
          message: texto,
          call_to_action: { type: 'SHOP_NOW', value: { link: areaDe(g, c) } },
        } }),
      });
    }
  }

  // 5. Pausar los conjuntos anteriores
  for (const id of CONJUNTOS_VIEJOS) {
    await post(id, { status: 'PAUSED' }, ok);
    console.log(`✓ conjunto anterior ${id} pausado`);
  }
  console.log(`\n✅ Campaña rearmada y PAUSADA. Para prenderla: META_ALLOW_WRITES=1 node --env-file=.env scripts/ads/manage.js --status ${CAMPANIA} ACTIVE --yes`);
}

main().catch((e) => {
  console.error(e instanceof MetaApiError ? `✗ ${e.message}\n${e.guidance}` : `✗ ${e.message}`);
  process.exit(1);
});
