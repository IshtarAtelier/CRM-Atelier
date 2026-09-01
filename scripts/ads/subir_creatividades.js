#!/usr/bin/env node
/**
 * Sube las placas de campaña como ANUNCIOS nuevos en un conjunto existente
 * de Meta Ads (click-to-WhatsApp). Pensado para cargar los lotes ad-l* que
 * genera scripts/social/ sin pasar por el Ads Manager a mano.
 *
 * Flujo obligatorio (ver scripts/ads/CLAUDE.md):
 *   1. El usuario confirma la operación puntual en la conversación.
 *   2. Sin --yes es DRY RUN: muestra anuncio por anuncio (nombre, etiqueta,
 *      copy, mensaje precargado, imágenes) y no toca nada.
 *   3. Con --yes ejecuta, solo con META_ALLOW_WRITES=1 inline +
 *      META_ADS_WRITE_TOKEN en el entorno.
 *
 * Uso:
 *   node scripts/ads/subir_creatividades.js --adset <id> [--piezas <id1,id2>] [--yes]
 *
 * --piezas filtra qué anuncios del lote van a ese conjunto (ids de pieza
 * separados por coma). Sin --piezas va el lote completo. Existe porque un
 * mismo lote puede repartirse: p.ej. el ángulo multifocal va al conjunto de
 * multifocales y el resto al ATP.
 *
 * Decisiones fijas de este script (no son opciones a propósito):
 *   - Los anuncios se crean SIEMPRE en PAUSED. Prenderlos es un acto aparte,
 *     de la dueña, en el Ads Manager o con manage.js --status.
 *   - Cada anuncio lleva su etiqueta [metaXxx] en el nombre Y en el mensaje
 *     precargado — sin eso la atribución del CRM no lo ve (regla del plan).
 *   - El copy sale del `caption` de la pieza en social/contenido/ — la placa
 *     y el anuncio dicen lo mismo porque lo escribe un solo archivo.
 *   - Un anuncio por pieza, con las 4 placas mapeadas por ubicación
 *     (asset_feed_spec con optimization_type PLACEMENT): feed 4:5, cuadrado
 *     1:1, story 9:16 y apaisado 1.91:1 — mismo criterio que documenta
 *     generar-campania.mjs.
 *   - Mejoras automáticas de Meta (standard_enhancements) desactivadas: las
 *     placas pasaron por el validador de contraste y zonas seguras; dejarlas
 *     "mejorar" por la plataforma desharía exactamente eso.
 *
 * page_id / instagram_user_id se leen de un anuncio existente del conjunto:
 * son los de la Página conectada y no cambian entre anuncios del mismo canal.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { get, post, accountId, MetaApiError } = require('./lib/meta_client');

const RAIZ = path.join(__dirname, '..', '..');
const CONTENIDO = path.join(RAIZ, 'social', 'contenido');
const PLACAS = path.join(RAIZ, 'public', 'social');

/**
 * Los anuncios a crear. `pieza` es el id base en social/contenido/ (el copy
 * sale de su caption); los 4 tamaños salen de public/social/<pieza>[-sufijo]/01.jpg.
 * La etiqueta es única por anuncio y NO se reusa entre lotes (meta-insights
 * la usa como clave de atribución).
 */
// Lote ad-atp: prospección fría para el conjunto ATP (público abierto), salido
// de la auditoría multi-agente de agosto 2026 (Meta + CRM + chats). Cubre los
// perfiles reales que compran: monofocal pragmático (cotización por foto de
// receta), présbita decidida (multifocal), y descubrimiento de la óptica
// (probarse en el local / línea propia estelar). Los lotes ad-l1 (multifocales)
// y ad-l2 (remarketing) quedan para sus campañas del plan.
// Lote ad-l4 (31/8/2026): remarketing que VENDE, pedido de Ishtar. El público
// ya interactuó con el IG o la web — no hay que presentarle la óptica, hay que
// darle el empujón: cupón QUIEROMISLENTES (verificado vivo contra la tienda en
// producción, vence 30/9), las 12 cuotas fijas (fórmula 31/8 noche) y la fecha
// límite. Fotos de la sesión editorial de junio. El lote ad-atp anterior ya
// está subido (10/8) — este archivo siempre carga el lote PENDIENTE.
const ANUNCIOS = [
  {
    pieza: 'ad-l4-cupon-vuelta',
    etiqueta: 'metaCuponVuelta',
    titulo: '10% OFF con el cupón QUIEROMISLENTES',
    mensaje: 'Hola! Vi lo del cupón QUIEROMISLENTES, ¿me ayudan a usarlo con el modelo que estuve viendo? [metaCuponVuelta]',
  },
  {
    pieza: 'ad-l4-doce-cuotas',
    etiqueta: 'meta12CuotasRmk',
    titulo: 'Hasta 12 cuotas fijas',
    mensaje: 'Hola! Quiero saber cómo es lo de las 12 cuotas para unos lentes que estuve viendo. [meta12CuotasRmk]',
  },
  {
    pieza: 'ad-l4-cupon-vence',
    etiqueta: 'metaCuponVence',
    titulo: 'El cupón QUIEROMISLENTES vence el 30/9',
    mensaje: 'Hola! Antes de que venza el cupón QUIEROMISLENTES quiero aprovecharlo, ¿me ayudan? [metaCuponVence]',
  },
];

/**
 * Las "mejoras automáticas" de Meta, apagadas una por una.
 *
 * El campo paraguas `standard_enhancements` quedó OBSOLETO: mandarlo hace que
 * Graph rechace la creatividad entera con un 100 ("El contenido no debería
 * incluir mejoras estándar"). Hay que declarar cada función por separado.
 *
 * Se apagan las que romperían el trabajo ya hecho: las de imagen desharían el
 * contraste y las zonas seguras que validó scripts/social, y
 * `text_optimizations` reescribe el copy — inaceptable cuando cada claim está
 * verificado contra business-info (la disciplina de R6 no termina en la placa).
 */
const MEJORAS_DESACTIVADAS = {
  image_templates: { enroll_status: 'OPT_OUT' },
  image_touchups: { enroll_status: 'OPT_OUT' },
  image_brightness_and_contrast: { enroll_status: 'OPT_OUT' },
  text_optimizations: { enroll_status: 'OPT_OUT' },
  product_extensions: { enroll_status: 'OPT_OUT' },
  site_extensions: { enroll_status: 'OPT_OUT' },
};

/** Sufijo de carpeta por ubicación (mismo esquema que generar-campania.mjs). */
const TAMANOS = [
  { clave: 'feed', sufijo: '', formato: '4:5 1080x1350' },
  { clave: 'cuadrado', sufijo: '-cuadrado', formato: '1:1 1080x1080' },
  { clave: 'story', sufijo: '-story', formato: '9:16 1080x1920' },
  { clave: 'apaisado', sufijo: '-apaisado', formato: '1.91:1 1200x628' },
];

/**
 * Qué placa ve cada ubicación. La última regla (cuadrado) no restringe
 * posiciones: es el comodín para toda ubicación no listada, porque el 1:1 es
 * el formato que menos se recorta (el porqué vive en generar-campania.mjs).
 */
function reglasDeUbicacion() {
  return [
    {
      priority: 1,
      image_label: { name: 'story' },
      customization_spec: {
        publisher_platforms: ['facebook', 'instagram', 'messenger'],
        facebook_positions: ['story', 'facebook_reels'],
        instagram_positions: ['story', 'reels'],
        messenger_positions: ['story'],
      },
    },
    {
      priority: 2,
      image_label: { name: 'apaisado' },
      customization_spec: {
        publisher_platforms: ['facebook'],
        facebook_positions: ['right_hand_column', 'marketplace', 'search'],
      },
    },
    {
      priority: 3,
      image_label: { name: 'feed' },
      customization_spec: {
        publisher_platforms: ['facebook', 'instagram'],
        facebook_positions: ['feed', 'video_feeds'],
        instagram_positions: ['stream', 'explore', 'explore_home', 'profile_feed'],
      },
    },
    {
      priority: 4,
      image_label: { name: 'cuadrado' },
      customization_spec: {
        publisher_platforms: ['facebook', 'instagram', 'messenger', 'audience_network'],
      },
    },
  ];
}

function cargarPieza(anuncio) {
  const json = JSON.parse(fs.readFileSync(path.join(CONTENIDO, `${anuncio.pieza}.json`), 'utf8'));
  if (!json.caption) throw new Error(`La pieza ${anuncio.pieza} no tiene caption — no hay copy para el anuncio.`);
  const imagenes = TAMANOS.map((t) => {
    const archivo = path.join(PLACAS, `${anuncio.pieza}${t.sufijo}`, '01.jpg');
    if (!fs.existsSync(archivo)) throw new Error(`Falta la placa ${archivo} — renderizar el lote completo antes de subir.`);
    return { ...t, archivo };
  });
  return { ...anuncio, cuerpo: json.caption, imagenes };
}

function usage(msg) {
  if (msg) console.error(msg);
  console.error('Uso: node scripts/ads/subir_creatividades.js --adset <id> [--piezas <id1,id2>] [--yes]');
  process.exit(1);
}

async function main() {
  const argv = process.argv.slice(2);
  const execute = argv.includes('--yes');
  const adsetIdx = argv.indexOf('--adset');
  const adsetId = adsetIdx > -1 ? argv[adsetIdx + 1] : null;
  if (!adsetId || !/^\d+$/.test(adsetId)) usage('Indicar el conjunto destino: --adset <id numérico>.');

  const piezasIdx = argv.indexOf('--piezas');
  let lote = ANUNCIOS;
  if (piezasIdx > -1) {
    const pedidas = (argv[piezasIdx + 1] || '').split(',').map((s) => s.trim()).filter(Boolean);
    const conocidas = new Set(ANUNCIOS.map((a) => a.pieza));
    const desconocidas = pedidas.filter((p) => !conocidas.has(p));
    if (!pedidas.length || desconocidas.length) {
      usage(`--piezas admite: ${[...conocidas].join(', ')}${desconocidas.length ? ` (no reconozco: ${desconocidas.join(', ')})` : ''}`);
    }
    lote = ANUNCIOS.filter((a) => pedidas.includes(a.pieza));
  }

  const adset = await get(adsetId, {
    fields: 'name,status,effective_status,destination_type,campaign{name,status},account_id',
  });
  if (adset.destination_type !== 'WHATSAPP') {
    throw new Error(
      `El conjunto "${adset.name}" tiene destino ${adset.destination_type}, no WHATSAPP — ` +
        'este script solo carga anuncios click-to-WhatsApp.',
    );
  }
  const act = `act_${adset.account_id}`;

  // Página e Instagram: se heredan de un anuncio que ya viva en el conjunto.
  const existentes = await get(`${adsetId}/ads`, {
    fields: 'creative{object_story_spec}',
    limit: '10',
  });
  const spec = (existentes.data || []).map((a) => a.creative?.object_story_spec).find((s) => s?.page_id);
  if (!spec) {
    throw new Error(
      'Ningún anuncio existente del conjunto expone page_id — no sé a qué Página colgar los nuevos. ' +
        'Cargar el primero a mano en Ads Manager o pasar por un conjunto que ya tenga anuncios.',
    );
  }

  const anuncios = lote.map(cargarPieza);

  console.log(`\nConjunto destino: ${adset.name} (${adsetId}) — ${adset.effective_status}`);
  console.log(`Campaña: ${adset.campaign?.name} (${adset.campaign?.status}) · cuenta ${act}`);
  console.log(`Página ${spec.page_id} · Instagram ${spec.instagram_user_id || '(el de la Página)'}`);
  console.log(`\nSe crearían ${anuncios.length} anuncios, TODOS EN PAUSED:\n`);
  for (const a of anuncios) {
    console.log(`── [${a.etiqueta}] ${a.titulo}`);
    console.log(`   nombre del anuncio: [${a.etiqueta}] ${a.titulo}`);
    console.log(`   copy: ${a.cuerpo.replace(/\n/g, ' ⏎ ')}`);
    console.log(`   mensaje precargado: ${a.mensaje}`);
    for (const img of a.imagenes) {
      const kb = Math.round(fs.statSync(img.archivo).size / 1024);
      console.log(`   ${img.clave.padEnd(8)} ${img.formato.padEnd(18)} ${path.relative(RAIZ, img.archivo)} (${kb} KB)`);
    }
    console.log('');
  }

  if (!execute) {
    console.log('DRY RUN: no se subió nada. Repetir con --yes (y META_ALLOW_WRITES=1 inline) para ejecutar.');
    return;
  }

  for (const a of anuncios) {
    // 1. Las 4 placas → image_hash (adimages acepta los bytes en base64).
    const hashes = {};
    for (const img of a.imagenes) {
      const nombre = `${a.pieza}${img.sufijo}-01.jpg`;
      const res = await post(
        `${act}/adimages`,
        { bytes: fs.readFileSync(img.archivo).toString('base64'), name: nombre },
        { confirm: true },
      );
      const subida = res.images?.[nombre] || Object.values(res.images || {})[0];
      if (!subida?.hash) throw new Error(`Meta no devolvió hash para ${nombre}.`);
      hashes[img.clave] = subida.hash;
      console.log(`   ✓ imagen ${img.clave} subida (${subida.hash.slice(0, 8)}…)`);
    }

    // 2. La creatividad: 4 placas mapeadas por ubicación + CTA a WhatsApp.
    const creative = await post(
      `${act}/adcreatives`,
      {
        name: `[${a.etiqueta}] ${a.titulo}`,
        object_story_spec: JSON.stringify({
          page_id: spec.page_id,
          ...(spec.instagram_user_id ? { instagram_user_id: spec.instagram_user_id } : {}),
        }),
        asset_feed_spec: JSON.stringify({
          optimization_type: 'PLACEMENT',
          ad_formats: ['SINGLE_IMAGE'],
          images: TAMANOS.map((t) => ({ hash: hashes[t.clave], adlabels: [{ name: t.clave }] })),
          bodies: [{ text: a.cuerpo }],
          titles: [{ text: a.titulo }],
          link_urls: [{ website_url: 'https://api.whatsapp.com/send' }],
          call_to_action_types: ['WHATSAPP_MESSAGE'],
          asset_customization_rules: reglasDeUbicacion(),
        }),
        page_welcome_message: JSON.stringify({
          type: 'VISUAL_EDITOR',
          version: 2,
          landing_screen_type: 'welcome_message',
          media_type: 'text',
          text_format: { customer_action_type: 'autofill_message', message: { autofill_message: { content: a.mensaje }, text: '' } },
        }),
        degrees_of_freedom_spec: JSON.stringify({
          creative_features_spec: MEJORAS_DESACTIVADAS,
        }),
      },
      { confirm: true },
    );
    console.log(`   ✓ creatividad ${creative.id}`);

    // 3. El anuncio, en PAUSED siempre.
    const ad = await post(
      `${act}/ads`,
      {
        name: `[${a.etiqueta}] ${a.titulo}`,
        adset_id: adsetId,
        creative: JSON.stringify({ creative_id: creative.id }),
        status: 'PAUSED',
      },
      { confirm: true },
    );
    console.log(`✓ [${a.etiqueta}] anuncio ${ad.id} creado en PAUSED.\n`);
  }

  console.log('Listo. Revisar los anuncios en el Ads Manager antes de activar nada.');
}

main().catch((e) => {
  const msg = e instanceof MetaApiError ? `${e.message}\n${e.guidance}` : e.message;
  console.error(`\n✗ ${msg}`);
  process.exit(1);
});
