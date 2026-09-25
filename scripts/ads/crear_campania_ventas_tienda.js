#!/usr/bin/env node
/**
 * Crea la campaña "Ventas | Tienda online" en Meta Ads, PAUSADA.
 *
 * Pedido de Ishtar (25/9/2026): apagar el remarketing de WhatsApp (no generaba
 * nada en la tienda) y armar una campaña de ventas a la tienda online que
 * alterne los productos con reels; el remarketing, recién cuando haya público.
 *
 * Flujo obligatorio (scripts/ads/CLAUDE.md):
 *   - Sin --yes es DRY RUN: lee lo que necesita de Meta y muestra exactamente
 *     qué crearía. No escribe nada.
 *   - Con --yes crea, solo con META_ALLOW_WRITES=1 INLINE en el comando y el
 *     token de escritura en el entorno. Una sola vez: si la campaña ya existe,
 *     se niega (no se duplica por reintentar).
 *
 * Uso:
 *   node --env-file=.env scripts/ads/crear_campania_ventas_tienda.js
 *   META_ALLOW_WRITES=1 node --env-file=.env scripts/ads/crear_campania_ventas_tienda.js --yes
 *
 * QUÉ CREA
 *   Campaña  OUTCOME_SALES, presupuesto de campaña US$5/día (Meta lo reparte
 *            entre los dos conjuntos según cuál rinda), PAUSADA. Es lo único
 *            que queda apagado: prenderla es UN interruptor y lo decide Ishtar.
 *   Conjunto "Catálogo": anuncio dinámico con TODO el catálogo de la tienda
 *            (160 productos): Meta le muestra a cada persona lo que más le
 *            puede interesar, con el precio del feed (siempre el de hoy).
 *   Conjunto "Reels": los desfiles de la tienda (mezcla y solo sol), sin
 *            precio quemado, generados por scripts/social/reel-desfile-tienda.mjs.
 *   Los dos: todo el país (el envío es gratis), 25-65, Advantage+ audience,
 *   excluye a los compradores web de 180 días, y optimizan por AGREGAR AL
 *   CARRITO: con ~1 compra por mes Meta no puede aprender a buscar compradores;
 *   el carrito es la señal más cercana a la compra con algo de volumen. Pasar a
 *   optimizar por compra cuando haya compras todas las semanas (ese cambio
 *   reinicia el aprendizaje).
 *
 * Copys: las cuotas salen de business-info (installmentsPromo), nunca a mano;
 * sin cupón y sin "con Mercado Pago" (fórmula del 31/8).
 */

require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const { get, getAllPages, post, MetaApiError } = require('./lib/meta_client');

const EJECUTAR = process.argv.includes('--yes');
const ACT = 'act_2107444353167176'; // cuenta en USD, donde vive toda la pauta activa
const PIXEL = process.env.META_PIXEL_ID;
const CATALOGO = '1010336864958719'; // "Atelier Óptica — Tienda Web"
const CAMPANIA_REFERENCIA = '120251235949780023'; // "Compras | Catalogo Tienda" (pausada 1/9): de ahí salen página, IG y la exclusión
const NOMBRE = 'Ventas | Tienda online';
const PRESUPUESTO_CENTAVOS = 500; // US$5/día
const TIENDA = 'https://atelieroptica.com.ar/tienda';
const ORIGEN = 'https://atelieroptica.com.ar';
const URL_TAGS = 'utm_source=meta&utm_medium=paid&utm_campaign={{campaign.id}}&utm_content={{ad.id}}';

const REELS = [
  { etiqueta: 'ventaDesfile', archivo: 'desfile-tienda', titulo: 'Comprá online con envío gratis',
    texto: (c) => `Lentes de sol, armazones de receta y clip-on de Cápsula Escarlata 👓 Elegí los tuyos en atelieroptica.com.ar\n\n${c}.\nEnvío gratis a todo el país 🇦🇷` },
  { etiqueta: 'ventaDesfileSol', archivo: 'desfile-tienda-sol', titulo: 'Lentes de sol con envío gratis',
    texto: (c) => `Tus próximos lentes de sol, en la tienda online 😎 Cápsula Escarlata en atelieroptica.com.ar\n\n${c}.\nEnvío gratis a todo el país 🇦🇷` },
];

/** Mejoras automáticas apagadas (mismo criterio que subir_creatividades.js). */
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

async function main() {
  if (!PIXEL) throw new Error('Falta META_PIXEL_ID en el entorno.');
  const cuotas = cuotasDeBusinessInfo();

  // ── Lecturas ──────────────────────────────────────────────────────────────
  const existentes = await getAllPages(`${ACT}/campaigns`, { fields: 'id,name,effective_status', limit: '100' });
  const repetida = existentes.find((c) => c.name === NOMBRE);
  if (repetida) {
    console.log(`Ya existe "${NOMBRE}" (${repetida.id}, ${repetida.effective_status}). No se crea otra.`);
    return;
  }

  const refAds = await getAllPages(`${CAMPANIA_REFERENCIA}/ads`, { fields: 'creative{object_story_spec}', limit: '5' });
  const spec = refAds.map((a) => a.creative?.object_story_spec).find((s) => s?.page_id);
  if (!spec) throw new Error('No se encontró página/IG en la campaña de referencia.');
  const refSets = await getAllPages(`${CAMPANIA_REFERENCIA}/adsets`, { fields: 'targeting', limit: '5' });
  const excluir = (refSets[0]?.targeting?.excluded_custom_audiences || []).filter((a) => /compradores web/i.test(a.name));

  const sets = await getAllPages(`${CATALOGO}/product_sets`, { fields: 'id,name,product_count', limit: '50' });
  const todo = sets.find((s) => s.name === 'All Products');
  if (!todo) throw new Error('No está el conjunto "All Products" en el catálogo.');

  for (const r of REELS) {
    const archivo = path.join(__dirname, '..', '..', 'public', 'social', 'reels', `${r.archivo}.mp4`);
    if (!fs.existsSync(archivo)) throw new Error(`Falta ${archivo}: generarlo con reel-desfile-tienda.mjs.`);
    r.url = `${ORIGEN}/social/reels/${r.archivo}.mp4`;
    r.cover = `${ORIGEN}/social/reels/${r.archivo}-cover.jpg`;
  }

  const targeting = {
    geo_locations: { countries: ['AR'], location_types: ['home', 'recent'] },
    age_min: 25,
    age_max: 65,
    ...(excluir.length ? { excluded_custom_audiences: excluir.map((a) => ({ id: a.id })) } : {}),
    targeting_automation: { advantage_audience: 1 },
  };
  const atribucion = [{ event_type: 'CLICK_THROUGH', window_days: 7 }, { event_type: 'VIEW_THROUGH', window_days: 1 }];
  const textoCatalogo = `Tus próximos lentes, en la tienda online 👓\n\n${cuotas}.\nEnvío gratis a todo el país 🇦🇷`;

  // ── Qué se va a crear ─────────────────────────────────────────────────────
  console.log(`\nCuenta ${ACT} · píxel ${PIXEL} · página ${spec.page_id} · IG ${spec.instagram_user_id || '—'}`);
  console.log(`\n1. Campaña "${NOMBRE}" · OUTCOME_SALES · US$${PRESUPUESTO_CENTAVOS / 100}/día de campaña · PAUSADA`);
  console.log(`2. Conjunto "Catálogo | Todo el país" · agregar al carrito · catálogo "${todo.name}" (${todo.product_count} productos)`);
  console.log(`   Anuncio [ventaCatalogo]: carrusel dinámico → ${TIENDA}`);
  console.log(`   Texto: ${textoCatalogo.replace(/\n/g, ' ⏎ ')}`);
  console.log(`3. Conjunto "Reels | Todo el país" · agregar al carrito`);
  for (const r of REELS) {
    console.log(`   Anuncio [${r.etiqueta}]: video ${r.url} → ${TIENDA}`);
    console.log(`   Título: ${r.titulo} · Texto: ${r.texto(cuotas).replace(/\n/g, ' ⏎ ')}`);
  }
  console.log(`\nPúblico (los dos conjuntos): Argentina, 25-65, Advantage+ audience${excluir.length ? `, excluye ${excluir.map((a) => a.name).join(', ')}` : ''}`);
  console.log('Conjuntos y anuncios quedan listos; la CAMPAÑA queda pausada: no gasta nada hasta prenderla.');

  if (!EJECUTAR) {
    console.log('\nDRY RUN: no se creó nada. Repetir con --yes (y META_ALLOW_WRITES=1 inline) para crear.');
    return;
  }

  // ── Escrituras ────────────────────────────────────────────────────────────
  const ok = { confirm: true };

  // Los videos primero: si Meta no los baja, no se crea nada a medias.
  for (const r of REELS) {
    const v = await post(`${ACT}/advideos`, { file_url: r.url, name: `${r.titulo} (${r.archivo})` }, ok);
    r.videoId = v.id;
    console.log(`✓ video ${r.archivo} subido (${v.id}); esperando que Meta lo procese…`);
  }
  for (const r of REELS) {
    for (let i = 0; i < 40; i++) {
      const s = await get(r.videoId, { fields: 'status' });
      const estado = s.status?.video_status;
      if (estado === 'ready') break;
      if (estado === 'error') throw new Error(`Meta no pudo procesar el video ${r.archivo}.`);
      await esperar(6000);
    }
  }

  const campania = await post(`${ACT}/campaigns`, {
    name: NOMBRE,
    objective: 'OUTCOME_SALES',
    status: 'PAUSED',
    buying_type: 'AUCTION',
    special_ad_categories: J([]),
    daily_budget: String(PRESUPUESTO_CENTAVOS),
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
  }, ok);
  console.log(`✓ campaña ${campania.id} (PAUSADA)`);

  const conjunto = async (nombre, promoted) => {
    const s = await post(`${ACT}/adsets`, {
      name: nombre,
      campaign_id: campania.id,
      billing_event: 'IMPRESSIONS',
      optimization_goal: 'OFFSITE_CONVERSIONS',
      promoted_object: J(promoted),
      targeting: J(targeting),
      attribution_spec: J(atribucion),
      status: 'ACTIVE',
    }, ok);
    console.log(`✓ conjunto "${nombre}" ${s.id}`);
    return s.id;
  };
  const setCatalogo = await conjunto('Catálogo | Todo el país', { pixel_id: PIXEL, custom_event_type: 'ADD_TO_CART', product_set_id: todo.id });
  const setReels = await conjunto('Reels | Todo el país', { pixel_id: PIXEL, custom_event_type: 'ADD_TO_CART' });

  const anuncio = async (adsetId, nombre, creativeParams) => {
    const c = await post(`${ACT}/adcreatives`, { name: nombre, url_tags: URL_TAGS,
      degrees_of_freedom_spec: J({ creative_features_spec: MEJORAS_DESACTIVADAS }), ...creativeParams }, ok);
    const a = await post(`${ACT}/ads`, { name: nombre, adset_id: adsetId, creative: J({ creative_id: c.id }), status: 'ACTIVE' }, ok);
    console.log(`✓ anuncio ${nombre} ${a.id}`);
  };

  await anuncio(setCatalogo, '[ventaCatalogo] Catálogo de la tienda', {
    product_set_id: todo.id,
    object_story_spec: J({
      page_id: spec.page_id,
      ...(spec.instagram_user_id ? { instagram_user_id: spec.instagram_user_id } : {}),
      template_data: {
        link: TIENDA,
        message: textoCatalogo,
        name: '{{product.name}}',
        call_to_action: { type: 'SHOP_NOW' },
        multi_share_end_card: false,
        format_option: 'carousel_images_multi_items',
      },
    }),
    asset_feed_spec: J({ ad_formats: ['CAROUSEL', 'COLLECTION'], optimization_type: 'FORMAT_AUTOMATION' }),
  });

  for (const r of REELS) {
    await anuncio(setReels, `[${r.etiqueta}] ${r.titulo}`, {
      object_story_spec: J({
        page_id: spec.page_id,
        ...(spec.instagram_user_id ? { instagram_user_id: spec.instagram_user_id } : {}),
        video_data: {
          video_id: r.videoId,
          image_url: r.cover,
          title: r.titulo,
          message: r.texto(cuotas),
          call_to_action: { type: 'SHOP_NOW', value: { link: TIENDA } },
        },
      }),
    });
  }

  console.log(`\n✅ Campaña "${NOMBRE}" creada y PAUSADA (${campania.id}). Para prenderla:`);
  console.log(`   META_ALLOW_WRITES=1 node --env-file=.env scripts/ads/manage.js --status ${campania.id} ACTIVE --yes`);
}

main().catch((e) => {
  console.error(e instanceof MetaApiError ? `✗ ${e.message}\n${e.guidance}` : `✗ ${e.message}`);
  process.exit(1);
});
