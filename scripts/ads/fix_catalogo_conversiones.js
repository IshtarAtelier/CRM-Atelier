/**
 * Corrección de la campaña "Coleccion | Catalogo Tienda" (120250804098450023).
 *
 * QUÉ ARREGLA (auditoría 27/8/2026, OK de Ishtar 28/8):
 *  - El conjunto viejo (120250804098460023) optimiza y factura por LINK_CLICKS:
 *    Meta compra clickeadores baratos → 6.116 clicks, 0 compras, US$70 en 14 días.
 *  - Geo toda Argentina sin semillas, contra los ganadores (ATP) que van a
 *    Córdoba+25km con 3 lookalikes.
 *  - Links de los anuncios a http:// (sin s) a la home, sin UTMs, y uno arrastra
 *    la extensión de WhatsApp de la campaña de Mensajes.
 *
 * QUÉ HACE (todo en una corrida, serializado por meta_client):
 *  1. Crea un conjunto NUEVO en la misma campaña (CBO US$5/día):
 *     OFFSITE_CONVERSIONS + INITIATED_CHECKOUT (el píxel tiene ~23 IC/semana y
 *     solo 2 Purchase/30d — optimizar a Purchase hoy sería quedarse sin señal;
 *     subir a PURCHASE recién con volumen sostenido), billing IMPRESSIONS,
 *     atribución 7d click + 1d view, geo Córdoba (key 84740) + 25 km,
 *     las 3 semillas lookalike de ATP, exclusión de clientes y compradores web,
 *     Advantage+ audience ON (Meta nunca expande la geo).
 *  2. Crea 2 creatives nuevos: el catálogo dinámico y el carrusel con mensaje,
 *     ambos con link https://atelieroptica.com.ar/tienda y url_tags con UTMs
 *     ({{campaign.id}}/{{ad.id}}: los nombres traen emojis y ensucian el panel).
 *     El carrusel sale SIN page_welcome_message (las consultas de WhatsApp ya
 *     las capta "Mensajes ✉️" a US$0,45/conversación).
 *  3. Crea los 2 anuncios en el conjunto nuevo (entran a revisión de Meta).
 *  4. Activa el conjunto nuevo y PAUSA el viejo (no se borra: guarda el
 *     historial y permite volver atrás).
 *
 * USO:
 *   node -r dotenv/config scripts/ads/fix_catalogo_conversiones.js            → dry run (muestra el plan)
 *   META_ALLOW_WRITES=1 META_APP_SECRET= node -r dotenv/config scripts/ads/fix_catalogo_conversiones.js --yes
 *   (META_APP_SECRET vacío inline: los system-user tokens de esta cuenta no son
 *    de esa app y Graph rechaza el appsecret_proof.)
 */
const c = require('./lib/meta_client.js');
// Desde el 31/8/26 a la noche el mensaje del anuncio no menciona el costo
// financiero ("hasta 12 cuotas fijas", fórmula de Ishtar): ya no hace falta
// leer RECARGO_MP_CUOTAS_LARGAS acá. Si un texto vuelve a necesitar el %, se
// lee del espejo CommonJS (wa-service/shared/business-info.js), nunca tipeado.

const CAMPANIA = '120250804098450023';
const ADSET_VIEJO = '120250804098460023';
const PIXEL = '789449199606215';
const PRODUCT_SET = '1743674383421832';
const PAGE_ID = '112571191818391';
const IG_USER = '17841458761171093';
const IMAGE_HASH_PORTADA = '9c08cf81dcc2303a93190c8aa826d779';

// Semillas de ATP (las 3 lookalike que usan los conjuntos que sí venden) y
// exclusiones (compradores web 180d + Clientes Atelier.csv).
const SEMILLAS = ['120248522532240023', '120248522769960023', '120248915147360023'];
const EXCLUSIONES = ['120250899853920023', '120248522647060023'];

const LINK = 'https://atelieroptica.com.ar/tienda';
const URL_TAGS = 'utm_source=meta&utm_medium=paid&utm_campaign={{campaign.id}}&utm_content={{ad.id}}';

const targeting = {
  age_min: 18,
  age_max: 65,
  geo_locations: {
    cities: [{ key: '84740', radius: 25, distance_unit: 'kilometer' }],
    location_types: ['home', 'recent'],
  },
  custom_audiences: SEMILLAS.map(id => ({ id })),
  excluded_custom_audiences: EXCLUSIONES.map(id => ({ id })),
  targeting_automation: { advantage_audience: 1 },
};

// Campaña NUEVA: la vieja tiene presupuesto CBO y Meta no permite conjuntos
// con metas distintas bajo el mismo CBO ("duplicá la campaña", dice el error).
// Además los ganadores (ATP) usan presupuesto por conjunto — se replica eso.
const campaniaNueva = {
  name: 'Compras | Catalogo Tienda',
  objective: 'OUTCOME_SALES',
  status: 'PAUSED',
  special_ad_categories: JSON.stringify([]),
  // Obligatorio al usar presupuesto por conjunto (no CBO). false = cada
  // conjunto gasta exactamente lo suyo, sin prestarse el 20% entre sí.
  is_adset_budget_sharing_enabled: 'false',
};

const adsetNuevo = {
  name: 'Compras | Córdoba + similares (conversiones)',
  status: 'PAUSED', // se activa al final, cuando los anuncios ya están creados
  daily_budget: '500', // US$5,00/día — mismo gasto que la campaña vieja, pero a nivel conjunto (ABO, como ATP)
  bid_strategy: 'LOWEST_COST_WITHOUT_CAP', // menor costo, sin tope de puja (lo que usan los ganadores)
  optimization_goal: 'OFFSITE_CONVERSIONS',
  billing_event: 'IMPRESSIONS',
  promoted_object: JSON.stringify({
    pixel_id: PIXEL,
    custom_event_type: 'INITIATED_CHECKOUT',
    product_set_id: PRODUCT_SET,
  }),
  attribution_spec: JSON.stringify([
    { event_type: 'CLICK_THROUGH', window_days: 7 },
    { event_type: 'VIEW_THROUGH', window_days: 1 },
  ]),
  targeting: JSON.stringify(targeting),
};

const creativeCatalogo = {
  name: `Catálogo tienda ${new Date().toISOString().slice(0, 10)} (https+utm)`,
  product_set_id: PRODUCT_SET,
  url_tags: URL_TAGS,
  object_story_spec: JSON.stringify({
    page_id: PAGE_ID,
    instagram_user_id: IG_USER,
    template_data: {
      link: LINK,
      name: '{{product.name}}',
      call_to_action: { type: 'SHOP_NOW' },
      multi_share_end_card: false,
      format_option: 'carousel_images_multi_items',
    },
  }),
};

const creativeMensaje = {
  name: `Carrusel cuotas ${new Date().toISOString().slice(0, 10)} (https+utm)`,
  product_set_id: PRODUCT_SET,
  url_tags: URL_TAGS,
  object_story_spec: JSON.stringify({
    page_id: PAGE_ID,
    instagram_user_id: IG_USER,
    template_data: {
      link: LINK,
      // REGLA DE COMUNICACIÓN (Ishtar, 31/8/2026 A LA NOCHE — reemplaza a la
      // de esa mañana): "12 cuotas fijas" (nunca "12 pagos"), sin el % y sin
      // "con Mercado Pago". Nunca "sin interés" en las 12 — eso son solo 3 y 6.
      message: `👓 Tus próximos lentes están en Atelier Óptica\n💳 6 cuotas sin interés · hasta 12 cuotas fijas\n🎁 Envío gratis a todo el país 🇦🇷`,
      call_to_action: { type: 'SHOP_NOW' },
      child_attachments: [
        { link: LINK, image_hash: IMAGE_HASH_PORTADA, call_to_action: { type: 'SHOP_NOW' }, static_card: true },
        { link: LINK, call_to_action: { type: 'SHOP_NOW' } },
      ],
      multi_share_end_card: false,
      format_option: 'carousel_images_multi_items',
    },
  }),
};

(async () => {
  const yes = process.argv.includes('--yes');
  const acct = c.accountId();

  console.log('== PLAN ==');
  console.log('Cuenta:', acct);
  console.log('1. Crear conjunto:', adsetNuevo.name);
  console.log('   goal LINK_CLICKS → OFFSITE_CONVERSIONS (INITIATED_CHECKOUT), billing → IMPRESSIONS');
  console.log('   atribución 1d click → 7d click + 1d view');
  console.log('   geo AR entera → Córdoba (84740) + 25 km · +3 semillas ATP · +2 exclusiones');
  console.log('2. Crear 2 creatives con', LINK, 'y UTMs');
  console.log('3. Crear 2 anuncios en el conjunto nuevo (van a revisión)');
  console.log('4. Activar conjunto nuevo · pausar', ADSET_VIEJO);
  if (!yes) { console.log('\nDRY RUN — nada tocado. Repetir con --yes para ejecutar.'); return; }

  // Reanudable: si una corrida anterior ya creó la campaña, pasar
  // CAMP_NUEVA_ID=<id> inline para no crear otra.
  const camp = process.env.CAMP_NUEVA_ID
    ? { id: process.env.CAMP_NUEVA_ID }
    : await c.post(`/${acct}/campaigns`, campaniaNueva, { confirm: true });
  console.log('✓ Campaña:', camp.id, process.env.CAMP_NUEVA_ID ? '(reusada)' : '(creada)');

  const adset = await c.post(`/${acct}/adsets`, { ...adsetNuevo, campaign_id: camp.id }, { confirm: true });
  console.log('✓ Conjunto creado:', adset.id);

  const cr1 = await c.post(`/${acct}/adcreatives`, creativeCatalogo, { confirm: true });
  console.log('✓ Creative catálogo:', cr1.id);
  const cr2 = await c.post(`/${acct}/adcreatives`, creativeMensaje, { confirm: true });
  console.log('✓ Creative carrusel:', cr2.id);

  const ad1 = await c.post(`/${acct}/ads`, {
    name: 'All Products - Compras',
    adset_id: adset.id,
    creative: JSON.stringify({ creative_id: cr1.id }),
    status: 'ACTIVE',
  }, { confirm: true });
  console.log('✓ Anuncio catálogo:', ad1.id);
  const ad2 = await c.post(`/${acct}/ads`, {
    name: 'Carrusel cuotas - Compras',
    adset_id: adset.id,
    creative: JSON.stringify({ creative_id: cr2.id }),
    status: 'ACTIVE',
  }, { confirm: true });
  console.log('✓ Anuncio carrusel:', ad2.id);

  await c.post(`/${adset.id}`, { status: 'ACTIVE' }, { confirm: true });
  await c.post(`/${camp.id}`, { status: 'ACTIVE' }, { confirm: true });
  console.log('✓ Campaña y conjunto nuevos ACTIVOS');
  await c.post(`/${CAMPANIA}`, { status: 'PAUSED' }, { confirm: true });
  console.log('✓ Campaña vieja PAUSADA entera (no borrada: historial y vuelta atrás)');

  console.log('\nListo. Los anuncios quedan en revisión de Meta; el aprendizaje arranca de cero (esperable).');
})().catch(e => { console.error('ERROR:', e.message, e.body ? JSON.stringify(e.body).slice(0, 500) : ''); process.exit(1); });
